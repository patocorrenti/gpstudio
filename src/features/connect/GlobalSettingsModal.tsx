import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type {
  DeviceGlobals,
  FootswitchMode,
  Gp5FootswitchMode,
  Gp5Globals,
  Gp50Globals,
  GlobalSysexKey,
  Gp5GlobalSysexKey,
  RecMode,
} from "@/device/session";
import { useDeviceSession, useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";

function LevelRow({
  label,
  value,
  min = -20,
  max = 20,
  unit = "dB",
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  unit?: string;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const usable = !disabled && value !== null;
  const shown = value === null ? "—" : unit ? `${value} ${unit}` : `${value}`;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{shown}</span>
      </span>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value ?? Math.max(min, Math.min(max, 0))]}
        disabled={!usable}
        aria-label={label}
        onValueChange={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined || value === null) {
            return;
          }
          onChange(nextValue);
        }}
        onValueCommit={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined || value === null) {
            return;
          }
          onCommit(nextValue);
        }}
      />
    </label>
  );
}

function Gp50GlobalSettingsForm({ globals }: { globals: Gp50Globals }) {
  const session = useDeviceSession();

  const setLevel = (key: GlobalSysexKey, value: number, flush: boolean) => {
    void session.setGlobalSysex(key, value, { flush });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">Master</h3>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-sm">
            <span>Master volume</span>
            <span className="tabular-nums text-muted-foreground">
              {globals.masterVolume === null ? "—" : globals.masterVolume}
            </span>
          </span>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[globals.masterVolume ?? 0]}
            disabled={globals.masterVolume === null}
            aria-label="Master volume"
            onValueChange={(next) => {
              const nextValue = next[0];
              if (nextValue === undefined || globals.masterVolume === null) {
                return;
              }
              void session.setMasterVolume(nextValue, { flush: false });
            }}
            onValueCommit={(next) => {
              const nextValue = next[0];
              if (nextValue === undefined || globals.masterVolume === null) {
                return;
              }
              void session.setMasterVolume(nextValue, { flush: true });
            }}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">Input / Output</h3>
        <LevelRow
          label="Input level"
          value={globals.inputLevel}
          disabled={false}
          onChange={(value) => setLevel("inputLevel", value, false)}
          onCommit={(value) => setLevel("inputLevel", value, true)}
        />
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>No CAB mode</span>
          <Switch
            checked={globals.noCab === true}
            disabled={globals.noCab === null}
            aria-label="No CAB mode"
            onCheckedChange={(checked) => {
              void session.setGlobalSysex("noCab", checked, { flush: true });
            }}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">USB Audio</h3>
        <LevelRow
          label="REC level"
          value={globals.recLevel}
          disabled={false}
          onChange={(value) => setLevel("recLevel", value, false)}
          onCommit={(value) => setLevel("recLevel", value, true)}
        />
        <LevelRow
          label="BT REC"
          value={globals.btRec}
          disabled={false}
          onChange={(value) => setLevel("btRec", value, false)}
          onCommit={(value) => setLevel("btRec", value, true)}
        />
        <LevelRow
          label="Monitor level"
          value={globals.monLevel}
          disabled={false}
          onChange={(value) => setLevel("monLevel", value, false)}
          onCommit={(value) => setLevel("monLevel", value, true)}
        />
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>REC mode (L)</span>
          <Select
            value={globals.recModeLeft ?? undefined}
            disabled={globals.recModeLeft === null}
            onValueChange={(next) => {
              void session.setGlobalSysex("recModeLeft", next as RecMode, { flush: true });
            }}
          >
            <SelectTrigger size="sm" aria-label="REC mode left">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wet">Wet</SelectItem>
              <SelectItem value="dry">Dry</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>REC mode (R)</span>
          <Select
            value={globals.recModeRight ?? undefined}
            disabled={globals.recModeRight === null}
            onValueChange={(next) => {
              void session.setGlobalSysex("recModeRight", next as RecMode, { flush: true });
            }}
          >
            <SelectTrigger size="sm" aria-label="REC mode right">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wet">Wet</SelectItem>
              <SelectItem value="dry">Dry</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">Footswitch</h3>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Mode</span>
          <Select
            value={globals.footswitchMode ?? undefined}
            disabled={globals.footswitchMode === null}
            onValueChange={(next) => {
              void session.setFootswitchMode(next as FootswitchMode);
            }}
          >
            <SelectTrigger size="sm" aria-label="Footswitch mode">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="patch">Patch</SelectItem>
              <SelectItem value="stomp">Stomp</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </section>
    </div>
  );
}

const GP5_FOOT_MODES: Gp5FootswitchMode[] = ["0-99", "0-9", "A-Z", "CTL", "Tuner"];

function Gp5GlobalSettingsForm({ globals }: { globals: Gp5Globals }) {
  const session = useDeviceSession();

  const setLevel = (key: Gp5GlobalSysexKey, value: number, flush: boolean) => {
    void session.setGlobalSysex(key, value, { flush });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">Master</h3>
        <LevelRow
          label="Global volume"
          value={globals.globalVolume}
          min={0}
          max={100}
          unit=""
          disabled={false}
          onChange={(value) => setLevel("globalVolume", value, false)}
          onCommit={(value) => setLevel("globalVolume", value, true)}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">Input / Output</h3>
        <LevelRow
          label="Input level"
          value={globals.inputLevel}
          disabled={false}
          onChange={(value) => setLevel("inputLevel", value, false)}
          onCommit={(value) => setLevel("inputLevel", value, true)}
        />
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>No CAB mode</span>
          <Switch
            checked={globals.noCab === true}
            disabled={globals.noCab === null}
            aria-label="No CAB mode"
            onCheckedChange={(checked) => {
              void session.setGlobalSysex("noCab", checked, { flush: true });
            }}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">USB Audio</h3>
        <LevelRow
          label="REC level"
          value={globals.recLevel}
          disabled={false}
          onChange={(value) => setLevel("recLevel", value, false)}
          onCommit={(value) => setLevel("recLevel", value, true)}
        />
        <LevelRow
          label="BT REC"
          value={globals.btRec}
          disabled={false}
          onChange={(value) => setLevel("btRec", value, false)}
          onCommit={(value) => setLevel("btRec", value, true)}
        />
        <LevelRow
          label="Monitor level"
          value={globals.monLevel}
          disabled={false}
          onChange={(value) => setLevel("monLevel", value, false)}
          onCommit={(value) => setLevel("monLevel", value, true)}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">Display</h3>
        <LevelRow
          label="Screen brightness"
          value={globals.screenBrightness}
          min={1}
          max={100}
          unit="%"
          disabled={false}
          onChange={(value) => setLevel("screenBrightness", value, false)}
          onCommit={(value) => setLevel("screenBrightness", value, true)}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-foreground">Footswitch</h3>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Mode</span>
          <Select
            value={globals.footswitchMode ?? undefined}
            disabled={globals.footswitchMode === null}
            onValueChange={(next) => {
              void session.setGp5FootswitchMode(next as Gp5FootswitchMode);
            }}
          >
            <SelectTrigger size="sm" aria-label="Footswitch mode">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {GP5_FOOT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </section>
    </div>
  );
}

function GlobalSettingsForm({ globals }: { globals: DeviceGlobals }) {
  if (globals.model === "gp5") {
    return <Gp5GlobalSettingsForm globals={globals} />;
  }
  return <Gp50GlobalSettingsForm globals={globals} />;
}

export function GlobalSettingsControl() {
  const snapshot = useSessionSnapshot();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (snapshot.status !== "connected") {
      setOpen(false);
    }
  }, [snapshot.status]);

  if (snapshot.status !== "connected" || !snapshot.globals) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Global settings"
        onClick={() => setOpen(true)}
      >
        <Settings className="size-4" aria-hidden />
        Global
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Global settings</DialogTitle>
          </DialogHeader>
          <GlobalSettingsForm globals={snapshot.globals} />
        </DialogContent>
      </Dialog>
    </>
  );
}
