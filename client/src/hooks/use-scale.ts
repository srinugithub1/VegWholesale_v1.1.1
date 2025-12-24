import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CompanySettings } from "@shared/schema";

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

// Deprecated local storage functions in favor of server sync
// but kept for fallback or initial state
function loadLocalSettings(): ScaleSettings {
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

function saveLocalSettings(settings: ScaleSettings) {
  try {
    localStorage.setItem("scaleSettings", JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save scale settings locally:", e);
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
  const [rawWeight, setRawWeight] = useState<number | null>(null);
  const rawWeightRef = useRef<number | null>(null);
  const [rawData, setRawData] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<ScaleSettings>(loadLocalSettings);

  // Sync with server settings
  const { data: companySettings, refetch: refetchSettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  // Apply server settings when loaded
  useEffect(() => {
    if (companySettings?.scaleSettings) {
      try {
        const remoteSettings = JSON.parse(companySettings.scaleSettings);
        // Only update if different to avoid loops, or just trust server as source of truth
        setSettingsState(prev => {
          const merged = { ...prev, ...remoteSettings };
          // Determine if we need to update local state
          if (JSON.stringify(prev) !== JSON.stringify(merged)) {
            return merged;
          }
          return prev;
        });
      } catch (e) {
        console.error("Failed to parse remote scale settings", e);
      }
    }
  }, [companySettings]);

  // Mutation to save settings to server
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: ScaleSettings) => {
      // We need to send the full company settings object, but with updated scaleSettings
      // If company settings don't exist, we create minimal one
      const payload = {
        ...(companySettings || { name: "My Business", address: "", phone: "", email: "" }),
        scaleSettings: JSON.stringify(newSettings),
      };

      const res = await apiRequest("POST", "/api/company-settings", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
    },
    onError: (err) => {
      console.error("Failed to save settings to server:", err);
    }
  });

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
      saveLocalSettings(updated); // Save locally immediately for UX

      // Save to server (debounced or immediate)
      // Since this is usually a settings dialog save button, immediate is fine.
      // But we need to call mutation. 
      // We can't call hook inside callback directly if it relies on render scope.
      // But we have saveSettingsMutation in scope.
      saveSettingsMutation.mutate(updated);

      return updated;
    });
  }, [saveSettingsMutation]);

  // Parse weight from scale output
  // Common formats: "ST,NT, +000.125kg", "  12.50 kg", "12.5", etc.
  const parseWeight = useCallback((data: string): { raw: number, rounded: number } | null => {
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

      // Apply custom rounding logic: Round to nearest whole number with 0.8 threshold
      // 1.799 -> 1.0 (Math.floor(1.999))
      // 1.800 -> 2.0 (Math.floor(2.0))
      let rounded = value;
      if (!isNaN(value)) {
        rounded = Math.floor(value + 0.2);
      }

      return isNaN(value) ? null : { raw: value, rounded };
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
              const result = parseWeight(line);
              if (result !== null) {
                setCurrentWeight(result.rounded);
                setRawWeight(result.raw); // Update state for UI to react
                rawWeightRef.current = result.raw; // Update ref for synchronous access if needed
              }
            }
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      // NetworkError means the device was disconnected (unplugged)
      if (error.name === "NetworkError" || error.message?.includes("NetworkError")) {
        console.log("Scale disconnected (NetworkError)");
        // Force state update to disconnected
        setIsConnected(false);
        setCurrentWeight(null);
        setError("Device disconnected. Please reconnect.");
      } else {
        console.error("Scale read error:", err);
        setError(`Read error: ${error.message}`);
      }
    } finally {
      isReadingRef.current = false;
      // Ensure lock is released
      try {
        readerRef.current?.releaseLock();
      } catch (e) {
        console.error("Failed to release lock:", e);
      }
      readerRef.current = null;

      // If we exited the loop, we are effectively disconnected
      setIsConnected(false);
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

    // Force cleanup before connecting
    if (isConnected || portRef.current) {
      await disconnect();
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
      setRawData("");
      setError(null);
    } catch (err) {
      console.warn("Disconnect warning (safe to ignore):", err);
      // Force disconnected state even if close failed
      setIsConnected(false);
      portRef.current = null;
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
    rawWeight: rawWeightRef.current, // Expose raw numeric weight
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
