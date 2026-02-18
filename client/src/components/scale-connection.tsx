import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Scale, Plug, Unplug, Settings, RefreshCw, AlertCircle, Check } from "lucide-react";
import { useScale, isWebSerialSupported, type ScaleSettings } from "@/hooks/use-scale";
import { useState } from "react";

type ScaleConnectionProps = {
  onWeightCapture?: (weight: number) => void;
  showCaptureButton?: boolean;
};

export function ScaleConnection({ onWeightCapture, showCaptureButton = true }: ScaleConnectionProps) {
  const scale = useScale();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleCapture = () => {
    if (scale.currentWeight !== null && onWeightCapture) {
      onWeightCapture(scale.currentWeight);
    }
  };

  if (!isWebSerialSupported()) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Weighing machine connection requires Chrome or Edge browser</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Weighing Machine
          {scale.isConnected ? (
            <Badge variant="default" className="ml-auto">Connected</Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto">Disconnected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scale.error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{scale.error}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={scale.clearError}>
              Dismiss
            </Button>
          </div>
        )}

        {scale.isConnected ? (
          <>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Current Reading</div>
              <div className="text-3xl font-mono font-bold text-primary" data-testid="text-scale-weight">
                {scale.currentWeight !== null ? `${scale.currentWeight.toFixed(3)} KG` : "---"}
              </div>
              {scale.rawData && (
                <div className="text-xs text-muted-foreground mt-2 font-mono">
                  Raw: {scale.rawData}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {showCaptureButton && (
                <Button
                  onClick={handleCapture}
                  disabled={scale.currentWeight === null}
                  className="flex-1"
                  data-testid="button-capture-weight"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Capture Weight
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={scale.requestWeight}
                title="Request weight reading"
                data-testid="button-request-weight"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={scale.disconnect}
                title="Disconnect scale"
                data-testid="button-disconnect-scale"
              >
                <Unplug className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={scale.connect}
              disabled={scale.isConnecting}
              className="flex-1"
              data-testid="button-connect-scale"
            >
              <Plug className="h-4 w-4 mr-2" />
              {scale.isConnecting ? "Connecting..." : "Connect Scale"}
            </Button>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-scale-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Scale Settings</DialogTitle>
                </DialogHeader>
                <ScaleSettingsForm
                  settings={scale.settings}
                  onSave={(newSettings) => {
                    scale.updateSettings(newSettings);
                    setSettingsOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Connect your USB/Serial weighing scale to capture weight readings directly into the app.
          Works with most scales that output via serial/COM port.
        </p>
      </CardContent>
    </Card>
  );
}

type ScaleSettingsFormProps = {
  settings: ScaleSettings;
  onSave: (settings: Partial<ScaleSettings>) => void;
};

function ScaleSettingsForm({ settings, onSave }: ScaleSettingsFormProps) {
  const [baudRate, setBaudRate] = useState(settings.baudRate.toString());
  const [dataBits, setDataBits] = useState(settings.dataBits.toString());
  const [stopBits, setStopBits] = useState(settings.stopBits.toString());
  const [parity, setParity] = useState<string>(settings.parity);

  const handleSave = () => {
    onSave({
      baudRate: parseInt(baudRate),
      dataBits: parseInt(dataBits) as 7 | 8,
      stopBits: parseInt(stopBits) as 1 | 2,
      parity: parity as "none" | "even" | "odd",
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure these settings to match your weighing scale. Check your scale manual for the correct values.
      </p>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="baudRate">Baud Rate</Label>
          <Select value={baudRate} onValueChange={setBaudRate}>
            <SelectTrigger id="baudRate" data-testid="select-baud-rate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1200">1200</SelectItem>
              <SelectItem value="2400">2400</SelectItem>
              <SelectItem value="4800">4800</SelectItem>
              <SelectItem value="9600">9600 (Most Common)</SelectItem>
              <SelectItem value="19200">19200</SelectItem>
              <SelectItem value="38400">38400</SelectItem>
              <SelectItem value="57600">57600</SelectItem>
              <SelectItem value="115200">115200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataBits">Data Bits</Label>
          <Select value={dataBits} onValueChange={setDataBits}>
            <SelectTrigger id="dataBits" data-testid="select-data-bits">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7</SelectItem>
              <SelectItem value="8">8 (Most Common)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stopBits">Stop Bits</Label>
          <Select value={stopBits} onValueChange={setStopBits}>
            <SelectTrigger id="stopBits" data-testid="select-stop-bits">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 (Most Common)</SelectItem>
              <SelectItem value="2">2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parity">Parity</Label>
          <Select value={parity} onValueChange={setParity}>
            <SelectTrigger id="parity" data-testid="select-parity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Most Common)</SelectItem>
              <SelectItem value="even">Even</SelectItem>
              <SelectItem value="odd">Odd</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} data-testid="button-save-settings">
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// Compact inline scale display for use in forms
export function ScaleWeightDisplay({ 
  weight, 
  onCapture 
}: { 
  weight: number | null; 
  onCapture?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
      <Scale className="h-4 w-4 text-muted-foreground" />
      <span className="font-mono font-semibold text-lg" data-testid="text-inline-weight">
        {weight !== null ? `${weight.toFixed(3)} KG` : "---"}
      </span>
      {onCapture && weight !== null && (
        <Button variant="ghost" size="sm" onClick={onCapture} className="ml-auto">
          Use
        </Button>
      )}
    </div>
  );
}
