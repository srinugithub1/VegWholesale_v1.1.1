import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Scale, Wifi, WifiOff, RefreshCw, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useScale } from "@/hooks/use-scale";

export default function Weighing() {
  const { toast } = useToast();

  // Real scale connection using Web Serial API
  // Hooks handles both Real and Demo modes now
  const scale = useScale();

  // Local state for UI display (syncs with scale hook)
  const [scaleSettingsOpen, setScaleSettingsOpen] = useState(false);

  // Live weight display
  const liveWeight = scale.currentWeight || 0;
  const weightStable = scale.isConnected && scale.currentWeight !== null;

  const toggleScaleConnection = async () => {
    if (scale.isConnected) {
      await scale.disconnect();
      toast({ title: "Scale Disconnected" });
    } else {
      const success = await scale.connect();
      if (success) {
        if (scale.isDemoMode) {
          toast({
            title: "Demo Mode Active",
            description: "Simulating weight readings.",
          });
        } else {
          toast({ title: "Scale Connected", description: "Weighing machine connected successfully." });
        }
      } else if (scale.error) {
        toast({ title: "Connection Failed", description: scale.error, variant: "destructive" });
      }
    }
  };

  const captureWeight = () => {
    if (weightStable && liveWeight > 0) {
      toast({
        title: "Weight Captured",
        description: `Captured ${liveWeight.toFixed(2)} KG from scale`,
      });
    } else {
      toast({
        title: "Weight Not Stable",
        description: "Please wait for the weight to stabilize before capturing.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Weighing Settings
            </h1>
            <p className="text-sm text-muted-foreground">Configure global scale settings and test connection</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={scale.isConnected ? "default" : "secondary"} className="gap-1">
            {scale.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {scale.isConnected ? "Scale Connected" : "Scale Disconnected"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Live Scale Display */}
          <Card className={scale.isConnected ? "border-primary" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Live Scale Reading
                  {scale.isDemoMode && <Badge variant="outline" className="text-xs">Demo</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={scaleSettingsOpen} onOpenChange={setScaleSettingsOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" data-testid="button-scale-settings">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Scale Settings</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Configure your weighing machine connection settings. Check your scale manual for correct values.
                        </p>
                        <div className="grid gap-4">
                          <div className="flex items-center justify-between">
                            <Label>Baud Rate</Label>
                            <Select value={scale.settings.baudRate.toString()} onValueChange={(v) => scale.updateSettings({ baudRate: parseInt(v) })}>
                              <SelectTrigger className="w-40" data-testid="select-baud-rate">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="9600">9600 (Common)</SelectItem>
                                <SelectItem value="4800">4800</SelectItem>
                                <SelectItem value="19200">19200</SelectItem>
                                <SelectItem value="115200">115200</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Data Bits</Label>
                            <Select value={scale.settings.dataBits.toString()} onValueChange={(v) => scale.updateSettings({ dataBits: parseInt(v) as 7 | 8 })}>
                              <SelectTrigger className="w-40" data-testid="select-data-bits">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="8">8 (Common)</SelectItem>
                                <SelectItem value="7">7</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Parity</Label>
                            <Select value={scale.settings.parity} onValueChange={(v) => scale.updateSettings({ parity: v as "none" | "even" | "odd" })}>
                              <SelectTrigger className="w-40" data-testid="select-parity">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None (Common)</SelectItem>
                                <SelectItem value="even">Even</SelectItem>
                                <SelectItem value="odd">Odd</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Weight Multiplier</Label>
                              <p className="text-[10px] text-muted-foreground">Fix decimal issues (e.g. 10 or 0.1)</p>
                            </div>
                            <Input
                              type="number"
                              className="w-40"
                              step="0.001"
                              value={scale.settings.multiplier || 1}
                              onChange={(e) => scale.updateSettings({ multiplier: parseFloat(e.target.value) || 1 })}
                              data-testid="input-multiplier"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="demo-mode-settings">Demo Mode</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Use for testing without hardware</span>
                              <input
                                type="checkbox"
                                id="demo-mode-settings"
                                className="h-4 w-4"
                                checked={scale.isDemoMode}
                                onChange={scale.toggleDemoMode}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Settings are saved automatically. Works with USB/Serial scales in Chrome/Edge browsers.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant={scale.isConnected ? "destructive" : "default"}
                    size="sm"
                    onClick={toggleScaleConnection}
                    disabled={!scale.isDemoMode && scale.isConnecting}
                    data-testid="button-toggle-scale"
                  >
                    {!scale.isDemoMode && scale.isConnecting ? "Connecting..." : scale.isConnected ? "Disconnect" : "Connect Scale"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className={`text-5xl font-mono font-bold text-center py-6 rounded-md ${scale.isConnected
                    ? weightStable
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    : "bg-muted text-muted-foreground"
                    }`} data-testid="display-live-weight">
                    {scale.isConnected ? `${liveWeight.toFixed(2)} KG` : "-- KG"}
                  </div>
                  <div className="text-center mt-2 text-sm">
                    {scale.isConnected ? (
                      weightStable ? (
                        <span className="text-green-600 dark:text-green-400">Weight Stable</span>
                      ) : (
                        <span className="text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Stabilizing...
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">Scale not connected</span>
                    )}
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={captureWeight}
                  disabled={!scale.isConnected || !weightStable || liveWeight <= 0}
                  className="min-w-[150px]"
                  data-testid="button-capture-weight"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Test Capture
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>This page is for configuring the weighing scale settings only.</p>
              <p>Ensure your weighing scale is connected via USB/Serial and the correct Baud Rate is selected.</p>
              <p>To Perform Sales using the scale, please navigate to the <b>Sell</b> tab.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
