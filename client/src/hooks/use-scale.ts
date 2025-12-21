import { useState, useCallback, useRef, useEffect } from "react";

// Type declarations for Web Serial API
declare global {
  interface Navigator {
    serial: Serial;
  }
  interface Serial {
    requestPort(): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }
  interface SerialPort {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
  }
  interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: "none" | "even" | "odd";
  }
}

export type ScaleSettings = {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: "none" | "even" | "odd";
  multiplier: number;
};

const DEFAULT_SETTINGS: ScaleSettings = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  multiplier: 1,
};

// Load settings from localStorage
function loadSettings(): ScaleSettings {
  try {
    const saved = localStorage.getItem("scaleSettings");
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load scale settings:", e);
  }
  return DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveSettings(settings: ScaleSettings) {
  try {
    localStorage.setItem("scaleSettings", JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save scale settings:", e);
  }
}

// Check if Web Serial API is supported
export function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

export function useScale() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [rawData, setRawData] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<ScaleSettings>(loadSettings);

  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(false);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const isReadingRef = useRef(false);

  // Update and save settings
  const updateSettings = useCallback((newSettings: Partial<ScaleSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Parse weight from scale output
  // Common formats: "ST,NT, +000.125kg", "  12.50 kg", "12.5", etc.
  const parseWeight = useCallback((data: string): number | null => {
    // Remove control characters and trim
    const cleaned = data.replace(/[\x00-\x1F\x7F]/g, " ").trim();

    if (!cleaned) return null;

    // Try to extract numeric value
    // Pattern 1: Standard format with sign and unit
    let match = cleaned.match(/([+-]?\d+\.?\d*)\s*(kg|g|lb)?/i);
    if (match) {
      let value = parseFloat(match[1]);
      const unit = match[2]?.toLowerCase();

      // Convert to KG if needed
      if (unit === "g") {
        value = value / 1000;
      } else if (unit === "lb") {
        value = value * 0.453592;
      }

      // Apply user-defined multiplier (correction factor)
      if (settings.multiplier && settings.multiplier !== 1) {
        value = value * settings.multiplier;
      }

      return isNaN(value) ? null : value;
    }

    return null;
  }, [settings.multiplier]);

  // Read data from scale
  const readLoop = useCallback(async () => {
    if (!portRef.current?.readable || isReadingRef.current) return;

    isReadingRef.current = true;
    let buffer = "";

    try {
      readerRef.current = portRef.current.readable.getReader();

      while (true) {
        const { value, done } = await readerRef.current.read();

        if (done) {
          break;
        }

        if (value) {
          const text = new TextDecoder().decode(value);
          buffer += text;

          // Look for complete readings (usually end with newline or carriage return)
          const lines = buffer.split(/[\r\n]+/);

          // Keep the last incomplete line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              setRawData(line);
              const weight = parseWeight(line);
              if (weight !== null) {
                setCurrentWeight(weight);
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "NetworkError") {
        console.error("Scale read error:", err);
        setError(`Read error: ${(err as Error).message}`);
      }
    } finally {
      isReadingRef.current = false;
      readerRef.current?.releaseLock();
      readerRef.current = null;
    }
  }, [parseWeight]);

  // Demo mode simulation loop
  useEffect(() => {
    if (isDemoMode && isConnected) {
      demoIntervalRef.current = setInterval(() => {
        // Simulate fluctuating weight
        const baseWeight = Math.random() * 50 + 10;
        const fluctuation = Math.random() * 0.5 - 0.25;
        const simulatedWeight = parseFloat((baseWeight + fluctuation).toFixed(2));
        setCurrentWeight(simulatedWeight);
        setRawData(`DEMO: ${simulatedWeight} KG`);
      }, 500);
    } else {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, [isDemoMode, isConnected]);

  // Connect to scale (Real or Demo)
  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    if (isDemoMode) {
      // Simulate connection delay
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
      }, 500);
      return true;
    }

    if (!isWebSerialSupported()) {
      setError("Web Serial API is not supported in this browser. Please use Chrome or Edge.");
      setIsConnecting(false);
      return false;
    }

    try {
      // Request port selection from user
      const port = await navigator.serial.requestPort();

      // Open with current settings
      await port.open({
        baudRate: settings.baudRate,
        dataBits: settings.dataBits,
        stopBits: settings.stopBits,
        parity: settings.parity,
      });

      portRef.current = port;
      setIsConnected(true);
      setCurrentWeight(null);

      // Start reading
      readLoop();

      setIsConnecting(false);
      return true;
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotFoundError") {
        setError("No serial port selected.");
      } else if (error.name === "SecurityError") {
        setError("Permission denied. Please allow access to the serial port.");
      } else {
        setError(`Connection failed: ${error.message}`);
      }
      setIsConnecting(false);
      return false;
    }
  }, [isDemoMode, settings, readLoop]);

  // Disconnect from scale
  const disconnect = useCallback(async () => {
    if (isDemoMode) {
      setIsConnected(false);
      setCurrentWeight(null);
      setRawData("");
      return;
    }

    try {
      // Cancel the reader if active
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }

      // Close the port
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }

      setIsConnected(false);
      setCurrentWeight(null);
      setRawData("");
      setError(null);
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  }, [isDemoMode]);

  // Send command to scale (e.g., "P" to request weight)
  const sendCommand = useCallback(async (command: string) => {
    if (isDemoMode) {
      // In demo mode, just log it
      console.log("Demo scale command:", command);
      return true;
    }

    if (!portRef.current?.writable) {
      setError("Scale not connected");
      return false;
    }

    try {
      const writer = portRef.current.writable.getWriter();
      await writer.write(new TextEncoder().encode(command + "\r\n"));
      writer.releaseLock();
      return true;
    } catch (err) {
      setError(`Send failed: ${(err as Error).message}`);
      return false;
    }
  }, [isDemoMode]);

  // Request weight reading (common command)
  const requestWeight = useCallback(() => {
    return sendCommand("P");
  }, [sendCommand]);

  // Capture current weight for use in form
  const captureWeight = useCallback((): number | null => {
    return currentWeight;
  }, [currentWeight]);

  const toggleDemoMode = useCallback((enabled: boolean) => {
    // If we're connected, disconnect before switching modes
    if (isConnected) {
      disconnect();
    }
    setIsDemoMode(enabled);
  }, [isConnected, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    isConnected,
    isConnecting,
    currentWeight,
    rawData,
    error,
    settings,
    isSupported: isWebSerialSupported(),
    isDemoMode,

    // Actions
    connect,
    disconnect,
    sendCommand,
    requestWeight,
    captureWeight,
    updateSettings,
    toggleDemoMode,
    clearError: () => setError(null),
  };
}
