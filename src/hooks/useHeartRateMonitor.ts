// Reused verbatim from Audit Jiwa (src/hooks/useHeartRateMonitor.ts) — the
// BLE GATT heart_rate connection logic is backend/device-agnostic and has no
// branding in it, so it's copied as-is rather than re-derived.

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Minimal ambient Web Bluetooth types ──────────────────────────────────
// Not exhaustive — only the heart_rate GATT surface this hook touches.

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value: DataView | undefined
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothDevice extends EventTarget {
  readonly id: string
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
}

interface NavigatorBluetooth {
  requestDevice(options: {
    filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>
    optionalServices?: string[]
  }): Promise<BluetoothDevice>
}

// ─── Public types ──────────────────────────────────────────────────────────

export type HeartRateMonitorState = 'unsupported' | 'disconnected' | 'connecting' | 'connected'

export type SensorContactStatus = 'not_supported' | 'not_detected' | 'detected'

export interface HeartRateReading {
  bpm: number
  rrIntervalsMs: number[]
  timestamp: number
  sensorContact: SensorContactStatus
  // The literal bytes of this GATT notification, straight off characteristic.value
  // — for callers that need to prove/inspect what the device actually sent on the
  // wire (e.g. detecting a device repeating identical packets), as opposed to any
  // reconstruction built from already-processed values.
  rawBytes: number[]
}

interface UseHeartRateMonitorOptions {
  onReading?: (reading: HeartRateReading) => void
  // Fired when the GATT connection drops without disconnect() being called
  // (e.g. strap removed, out of range) — never fired for a manual disconnect.
  onUnexpectedDisconnect?: () => void
}

function getBluetooth(): NavigatorBluetooth | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { bluetooth?: NavigatorBluetooth }).bluetooth
}

// ─── Parse heart_rate_measurement (GATT 0x2A37) ────────────────────────────
// Flags byte: bit0 HR format, bit1-2 sensor contact, bit3 energy expended present, bit4 RR-interval present.

function parseHeartRateMeasurement(
  value: DataView,
): { bpm: number; rrIntervalsMs: number[]; sensorContact: SensorContactStatus } {
  const flags = value.getUint8(0)
  let index = 1
  let bpm: number
  if (flags & 0x1) {
    bpm = value.getUint16(index, true)
    index += 2
  } else {
    bpm = value.getUint8(index)
    index += 1
  }
  if ((flags >> 3) & 0x1) index += 2 // energy expended (UINT16), unused

  const rrIntervalsMs: number[] = []
  if ((flags >> 4) & 0x1) {
    while (index + 1 < value.byteLength) {
      const rawRrUnits = value.getUint16(index, true)
      rrIntervalsMs.push((rawRrUnits / 1024) * 1000)
      index += 2
    }
  }

  // Bit 2: Sensor Contact Status feature supported. Bit 1 (only meaningful
  // when bit 2 = 1): contact currently detected. Straps with poor/dry
  // electrode contact routinely double-count beats (T-wave oversensing,
  // motion/EMG artifact) — this is the device's own confirmation of that,
  // not a guess computed from the BPM/RR numbers themselves.
  const contactFeatureSupported = (flags >> 2) & 0x1
  const contactDetected = (flags >> 1) & 0x1
  const sensorContact: SensorContactStatus = !contactFeatureSupported
    ? 'not_supported'
    : contactDetected
    ? 'detected'
    : 'not_detected'

  return { bpm, rrIntervalsMs, sensorContact }
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useHeartRateMonitor(options?: UseHeartRateMonitorOptions) {
  const [state, setState] = useState<HeartRateMonitorState>(getBluetooth() ? 'disconnected' : 'unsupported')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const onReadingRef = useRef(options?.onReading)
  onReadingRef.current = options?.onReading
  const onUnexpectedDisconnectRef = useRef(options?.onUnexpectedDisconnect)
  onUnexpectedDisconnectRef.current = options?.onUnexpectedDisconnect

  const handleValueChanged = useCallback((event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    if (!characteristic.value) return
    const { bpm: heartRate, rrIntervalsMs, sensorContact } = parseHeartRateMeasurement(characteristic.value)
    const raw = new Uint8Array(characteristic.value.buffer, characteristic.value.byteOffset, characteristic.value.byteLength)
    const rawBytes = Array.from(raw)
    if (import.meta.env.DEV) {
      console.log('[BLE] raw bytes:', rawBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')), 'sensorContact:', sensorContact)
    }
    setBpm(heartRate)
    onReadingRef.current?.({ bpm: heartRate, rrIntervalsMs, sensorContact, timestamp: performance.now(), rawBytes })
  }, [])

  const handleGattDisconnected = useCallback(() => {
    // disconnect() strips this listener before calling gatt.disconnect(), so
    // reaching here always means an out-of-band drop (strap off, out of range).
    // deviceRef is deliberately NOT cleared here (unlike disconnect()) — it's
    // the already-authorized BluetoothDevice, and reconnect() needs it to
    // re-establish the GATT connection without a new requestDevice() picker
    // (which requires a user gesture and can't run from e.g. visibilitychange).
    setState(getBluetooth() ? 'disconnected' : 'unsupported')
    setBpm(null)
    characteristicRef.current = null
    onUnexpectedDisconnectRef.current?.()
  }, [])

  const connect = useCallback(async () => {
    const bluetooth = getBluetooth()
    if (!bluetooth) {
      setState('unsupported')
      return
    }
    setError(null)
    setState('connecting')
    try {
      const device = await bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      deviceRef.current = device
      setDeviceName(device.name ?? 'Peranti HRV')
      setDeviceId(device.id)
      device.addEventListener('gattserverdisconnected', handleGattDisconnected)

      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService('heart_rate')
      const characteristic = await service.getCharacteristic('heart_rate_measurement')
      characteristicRef.current = characteristic
      characteristic.addEventListener('characteristicvaluechanged', handleValueChanged)
      await characteristic.startNotifications()
      setState('connected')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const userCancelled = /cancel/i.test(message)
      setError(userCancelled ? null : message)
      setState(getBluetooth() ? 'disconnected' : 'unsupported')
      deviceRef.current = null
      characteristicRef.current = null
    }
  }, [handleValueChanged, handleGattDisconnected])

  // Re-establish the GATT connection to the device this hook already holds a
  // reference to (set by a prior connect()), without prompting the device
  // picker again — safe to call from contexts with no user gesture, e.g. a
  // visibilitychange handler after the OS silently dropped the BLE link.
  // No-ops if there is no known device (connect() was never called, or the
  // user deliberately disconnected via disconnect()).
  const reconnect = useCallback(async (): Promise<boolean> => {
    const device = deviceRef.current
    if (!device?.gatt) return false
    setError(null)
    setState('connecting')
    try {
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService('heart_rate')
      const characteristic = await service.getCharacteristic('heart_rate_measurement')
      const previous = characteristicRef.current
      if (previous) previous.removeEventListener('characteristicvaluechanged', handleValueChanged)
      characteristicRef.current = characteristic
      characteristic.addEventListener('characteristicvaluechanged', handleValueChanged)
      await characteristic.startNotifications()
      setDeviceName(device.name ?? 'Peranti HRV')
      setDeviceId(device.id)
      setState('connected')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useHeartRateMonitor] reconnect failed:', message)
      setError(message)
      setState(getBluetooth() ? 'disconnected' : 'unsupported')
      return false
    }
  }, [handleValueChanged])

  const disconnect = useCallback(() => {
    const characteristic = characteristicRef.current
    if (characteristic) {
      characteristic.removeEventListener('characteristicvaluechanged', handleValueChanged)
      characteristic.stopNotifications().catch(() => {})
    }
    const device = deviceRef.current
    if (device) {
      device.removeEventListener('gattserverdisconnected', handleGattDisconnected)
      if (device.gatt?.connected) device.gatt.disconnect()
    }
    deviceRef.current = null
    characteristicRef.current = null
    setState(getBluetooth() ? 'disconnected' : 'unsupported')
    setBpm(null)
    setDeviceName(null)
    setDeviceId(null)
    setError(null)
  }, [handleValueChanged, handleGattDisconnected])

  // Disconnect the GATT server on unmount so we don't leak a dangling BLE connection.
  useEffect(() => {
    return () => {
      const characteristic = characteristicRef.current
      if (characteristic) {
        characteristic.removeEventListener('characteristicvaluechanged', handleValueChanged)
        characteristic.stopNotifications().catch(() => {})
      }
      const device = deviceRef.current
      if (device) {
        device.removeEventListener('gattserverdisconnected', handleGattDisconnected)
        if (device.gatt?.connected) device.gatt.disconnect()
      }
    }
  }, [handleValueChanged, handleGattDisconnected])

  return { state, deviceName, deviceId, bpm, error, connect, disconnect, reconnect }
}
