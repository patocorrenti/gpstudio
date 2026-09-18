import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Ban, ChevronLeft, ChevronRight, Copy, Download, Ellipsis, Loader2, Pencil, Save } from "lucide-react";
import iconAmp from "@/assets/img/icon-AMP.png";
import iconCab from "@/assets/img/icon-CAB.png";
import iconDly from "@/assets/img/icon-DLY.png";
import iconDst from "@/assets/img/icon-DST.png";
import iconEq from "@/assets/img/icon-EQ.png";
import iconExp from "@/assets/img/icon-EXP.png";
import iconMod from "@/assets/img/icon-MOD.png";
import iconNr from "@/assets/img/icon-NR.png";
import iconNs from "@/assets/img/icon-NS.png";
import iconPre from "@/assets/img/icon-PRE.png";
import iconRvb from "@/assets/img/icon-RVB.png";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  modelById,
  modelsForKind,
  type FxControl,
} from "@/device/catalog";
import type { DeviceModel } from "@/device/models";
import {
  chainSlotBypassed,
  chainSlotLabel,
  formatPatch,
  formatPatchOption,
  isEffectSlot,
  isMovableEffect,
  PATCH_COUNT,
  type AudioChain,
  type AudioChainSlot,
  type ChainSlotId,
  type EffectId,
} from "@/device/session";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** Cable through the icon: pt-2 + grip h-3 + gap-2 + half of size-14. */
const CHAIN_CABLE_TOP = "calc(3.5rem + 1px)";

const CHAIN_SLOT_ICONS: Record<ChainSlotId, string> = {
  nr: iconNr,
  pre: iconPre,
  dst: iconDst,
  ns: iconNs,
  amp: iconAmp,
  cab: iconCab,
  eq: iconEq,
  mod: iconMod,
  dly: iconDly,
  rvb: iconRvb,
  exp: iconExp,
};

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

function triggerPatchDownload(filename: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PatchBar({
  patch,
  patchNames,
  busy,
  canExportPatch,
}: {
  patch: number;
  patchNames: (string | null)[];
  busy: boolean;
  canExportPatch: boolean;
}) {
  const session = useDeviceSession();
  const currentName = patchNames[patch];
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateDest, setDuplicateDest] = useState(String((patch + 1) % PATCH_COUNT));
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const destIndex = Number.parseInt(duplicateDest, 10);
  const destName =
    Number.isInteger(destIndex) && destIndex !== patch ? patchNames[destIndex] : null;
  const destOccupied = Boolean(destName);

  function openRename() {
    setRenameValue(currentName ?? "");
    setRenameOpen(true);
  }

  function openDuplicate() {
    setDuplicateDest(String((patch + 1) % PATCH_COUNT));
    setOverwriteOpen(false);
    setDuplicateOpen(true);
  }

  function confirmRename() {
    void session.renamePatch(renameValue);
    setRenameOpen(false);
  }

  function confirmDuplicate() {
    if (!Number.isInteger(destIndex) || destIndex === patch) {
      return;
    }
    if (destOccupied && !overwriteOpen) {
      setOverwriteOpen(true);
      return;
    }
    void session.duplicatePatch(destIndex);
    setDuplicateOpen(false);
    setOverwriteOpen(false);
  }

  async function downloadPatch() {
    const file = await session.downloadCurrentPatch();
    if (!file) {
      return;
    }
    triggerPatchDownload(file.filename, file.bytes);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Previous patch"
        disabled={busy}
        className="size-12 bg-muted dark:bg-muted/40 dark:hover:bg-muted/50"
        onClick={() => void session.stepPatch(-1)}
      >
        <ChevronLeft className="size-6" />
      </Button>
      <Select
        value={String(patch)}
        onValueChange={(value) => {
          void session.setPatch(Number.parseInt(value, 10));
        }}
      >
        <SelectTrigger
          aria-label="Select patch"
          size="default"
          className="h-12 min-h-12 w-72 min-w-72 justify-center border-transparent bg-muted py-0 text-xl font-semibold tabular-nums data-[size=default]:h-12 dark:border-transparent dark:bg-muted/40 dark:hover:bg-muted/50"
        >
          <SelectValue>
            {currentName ? formatPatchOption(patch, currentName) : formatPatch(patch)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72 min-w-72">
          {patchOptions.map((option) => (
            <SelectItem
              key={option}
              value={String(option)}
              className="font-medium tabular-nums"
            >
              {formatPatchOption(option, patchNames[option])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Next patch"
        disabled={busy}
        className="size-12 bg-muted dark:bg-muted/40 dark:hover:bg-muted/50"
        onClick={() => void session.stepPatch(1)}
      >
        <ChevronRight className="size-6" />
      </Button>
      <div className="ml-2 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          onClick={() => void session.savePatch()}
        >
          <Save />
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          aria-label="Rename patch"
          onClick={openRename}
        >
          <Pencil />
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          aria-label="Duplicate patch"
          onClick={openDuplicate}
        >
          <Copy />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !canExportPatch}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          aria-label="Download patch"
          onClick={() => void downloadPatch()}
        >
          <Download />
          Download
        </Button>
      </div>
      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename patch</DialogTitle>
            <DialogDescription>
              At most 10 characters. Letters, digits, space, and hyphen.
            </DialogDescription>
          </DialogHeader>
          <Input
            id="rename-patch"
            value={renameValue}
            maxLength={10}
            autoFocus
            aria-label="Patch name"
            onChange={(event) => {
              setRenameValue(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmRename();
              }
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmRename} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={duplicateOpen}
        onOpenChange={(open) => {
          setDuplicateOpen(open);
          if (!open) {
            setOverwriteOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {overwriteOpen ? "Overwrite patch" : "Duplicate patch"}
            </DialogTitle>
            <DialogDescription>
              {overwriteOpen
                ? `Slot ${formatPatch(destIndex)} already has ${destName}. Overwrite it?`
                : "Copy the current working patch onto another slot. The selected patch stays the same."}
            </DialogDescription>
          </DialogHeader>
          {overwriteOpen ? null : (
            <Select
              value={duplicateDest}
              onValueChange={(value) => {
                setDuplicateDest(value);
                setOverwriteOpen(false);
              }}
            >
              <SelectTrigger aria-label="Destination slot" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {patchOptions
                  .filter((option) => option !== patch)
                  .map((option) => (
                    <SelectItem
                      key={option}
                      value={String(option)}
                      className="font-medium tabular-nums"
                    >
                      {formatPatchOption(option, patchNames[option])}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (overwriteOpen) {
                  setOverwriteOpen(false);
                  return;
                }
                setDuplicateOpen(false);
              }}
            >
              {overwriteOpen ? "Back" : "Cancel"}
            </Button>
            <Button type="button" onClick={confirmDuplicate}>
              {overwriteOpen ? "Overwrite" : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function slotClassName(enabled: boolean): string {
  return cn(
    "relative flex min-w-18 flex-col items-center gap-2 rounded-lg px-3 pt-2 pb-3 text-center",
    enabled ? "bg-muted text-foreground dark:bg-muted/40" : "text-muted-foreground",
  );
}

function AudioChainSlotView({
  slot,
  chain,
  disabled,
  isFirst,
  isLast,
}: {
  slot: AudioChainSlot;
  chain: AudioChain;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const session = useDeviceSession();
  const label = chainSlotLabel(slot.id);
  const icon = CHAIN_SLOT_ICONS[slot.id];
  const bypassed = chainSlotBypassed(chain, slot.id);
  const power = slot.enabled ? "on" : "off";
  const movable = isMovableEffect(slot.id);
  const sortable = movable && !disabled;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: slot.id,
      disabled: !sortable,
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(slotClassName(slot.enabled), sortable && "cursor-grab")}
      {...(sortable ? attributes : {})}
      {...(sortable ? listeners : {})}
    >
      <span
        className={cn(
          "relative z-10 flex h-3 w-full items-center justify-center",
          movable && !slot.enabled && "opacity-50",
        )}
        aria-hidden
      >
        {movable ? (
          <Ellipsis className="size-4 text-muted-foreground/70" />
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-[1] h-0.5 bg-muted-foreground/25 transition-opacity",
          isDragging && "opacity-0",
          isFirst ? "left-[-0.75rem]" : "left-[-0.25rem]",
          isLast ? "right-[-0.75rem]" : "right-[-0.25rem]",
        )}
        style={{ top: CHAIN_CABLE_TOP }}
      />
      <div className="relative flex min-h-6 w-full flex-col items-center justify-center gap-1">
        <div className={cn("relative", slot.enabled ? "z-10" : "z-0")}>
          {icon ? (
            <img
              src={icon}
              alt=""
              className={cn(
                "object-contain size-14",
                slot.enabled ? "" : "opacity-20",
              )}
            />
          ) : null}
          {bypassed ? (
            <span
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              aria-hidden="true"
            >
              <Ban className="size-11 text-destructive drop-shadow-sm" strokeWidth={2.5} />
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "relative z-10 text-xs font-semibold tracking-wide",
            !slot.enabled && "opacity-80",
          )}
        >
          {label}
        </span>
      </div>
      <Switch
        size="sm"
        checked={slot.enabled}
        disabled={disabled}
        className={cn(
          "relative z-10",
          "data-checked:bg-primary/45 data-unchecked:bg-foreground/20 dark:data-unchecked:bg-input/80 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-muted-foreground",
        )}
        aria-label={bypassed ? `${label} ${power}, bypassed` : `${label} ${power}`}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onCheckedChange={(checked) => {
          if (checked === slot.enabled) {
            return;
          }
          void session.toggleChainSlot(slot.id);
        }}
      />
    </div>
  );
}

function AudioChainRow({
  chain,
  disabled,
}: {
  chain: AudioChain;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const ids = chain.map((slot) => slot.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const fromIndex = chain.findIndex((slot) => slot.id === active.id);
    const toIndex = chain.findIndex((slot) => slot.id === over.id);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    void session.reorderChain(fromIndex, toIndex);
  }

  return (
    <DndContext
      sensors={disabled ? [] : sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ol
          aria-label="Audio chain"
          className="flex flex-wrap items-center justify-center gap-2 overflow-visible"
        >
          {chain.map((slot, index) => (
            <li key={slot.id} className="overflow-visible">
              <AudioChainSlotView
                slot={slot}
                chain={chain}
                disabled={disabled}
                isFirst={index === 0}
                isLast={index === chain.length - 1}
              />
            </li>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function formatControlValue(control: FxControl, value: number): string {
  if (control.display === "toggle") {
    return value >= 1 ? "On" : "Off";
  }
  if (control.step < 1) {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

function SlotControl({
  kind,
  control,
  value,
  disabled,
}: {
  kind: EffectId;
  control: FxControl;
  value: number;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const label = `${chainSlotLabel(kind)} ${control.label}`;

  if (control.display === "toggle") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{control.label}</span>
        <Switch
          size="sm"
          checked={value >= 1}
          disabled={disabled}
          aria-label={`${label} ${value >= 1 ? "on" : "off"}`}
          onCheckedChange={(checked) => {
            void session.setSlotControl(kind, control.index, checked ? 1 : 0, {
              flush: true,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{control.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatControlValue(control, value)}
        </span>
      </div>
      <Slider
        min={control.min}
        max={control.max}
        step={control.step}
        value={[value]}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined) {
            return;
          }
          void session.setSlotControl(kind, control.index, nextValue);
        }}
        onValueCommit={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined) {
            return;
          }
          void session.setSlotControl(kind, control.index, nextValue, { flush: true });
        }}
      />
    </div>
  );
}

function SlotControlPanel({
  slot,
  pedal,
  disabled,
}: {
  slot: AudioChainSlot & { id: EffectId; modelId: string; values: number[] };
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const model = modelById(slot.modelId);
  if (!model) {
    return null;
  }
  const options = modelsForKind(slot.id, pedal);
  const kindLabel = chainSlotLabel(slot.id);

  return (
    <section
      className="flex min-w-0 w-full flex-col gap-3 rounded-lg bg-muted/60 px-4 py-3 dark:bg-muted/30"
      aria-label={`${kindLabel} controls`}
    >
      <div className="flex items-center gap-3">
        <h2 className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-semibold tracking-wide">
          <img
            src={CHAIN_SLOT_ICONS[slot.id]}
            alt=""
            className="size-7 object-contain"
          />
          {kindLabel}
        </h2>
        {options.length > 1 ? (
          <Select
            value={model.id}
            disabled={disabled}
            onValueChange={(value) => {
              void session.setSlotModel(slot.id, value);
            }}
          >
            <SelectTrigger
              aria-label={`${kindLabel} model`}
              size="sm"
              className="h-8 w-full min-w-52 flex-1"
            >
              <SelectValue>{model.label}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="min-w-0 flex-1 text-right text-sm text-muted-foreground">
            {model.label}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {model.controls.map((control) => (
          <SlotControl
            key={control.index}
            kind={slot.id}
            control={control}
            value={slot.values[control.index] ?? control.default}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

function SlotControlPanels({
  chain,
  pedal,
  disabled,
}: {
  chain: AudioChain;
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const panels = chain.flatMap((slot) => {
    if (!isEffectSlot(slot.id) || !slot.enabled) {
      return [];
    }
    if (chainSlotBypassed(chain, slot.id)) {
      return [];
    }
    if (slot.modelId === undefined || slot.values === undefined) {
      return [];
    }
    return [
      {
        ...slot,
        id: slot.id,
        modelId: slot.modelId,
        values: slot.values,
      },
    ];
  });
  if (panels.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 grid w-full max-w-6xl grid-cols-1 gap-3 px-2 pb-6 md:grid-cols-2">
      {panels.map((slot) => (
        <SlotControlPanel
          key={slot.id}
          slot={slot}
          pedal={pedal}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function PatchBody({
  chain,
  pedal,
  busy,
}: {
  chain: AudioChain;
  pedal: DeviceModel;
  busy: boolean;
}) {
  return (
    <div className="relative mt-4 flex min-h-40 w-full flex-1 flex-col items-center">
      <div
        className={cn("flex w-full flex-col items-center", busy && "invisible")}
        aria-hidden={busy}
      >
        <AudioChainRow chain={chain} disabled={busy} />
        <SlotControlPanels chain={chain} pedal={pedal} disabled={busy} />
      </div>
      {busy ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background"
          role="status"
          aria-label="Syncing audio chain"
        >
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}

function SyncingController() {
  return (
    <section role="status" className="flex flex-1 flex-col items-center">
      <p className="text-muted-foreground">Syncing with the pedal…</p>
    </section>
  );
}

function ConnectedController() {
  const snapshot = useSessionSnapshot();
  if (snapshot.status !== "connected") {
    return null;
  }
  if (snapshot.sync === "syncing") {
    return <SyncingController />;
  }

  return (
    <section className="flex flex-1 flex-col items-center">
      <PatchBar
        patch={snapshot.patch}
        patchNames={snapshot.patchNames}
        busy={snapshot.chainSync === "syncing"}
        canExportPatch={snapshot.canExportPatch}
      />
      <PatchBody
        chain={snapshot.chain}
        pedal={snapshot.model}
        busy={snapshot.chainSync === "syncing"}
      />
    </section>
  );
}

export function ControllerPage() {
  return (
    <RequirePedal>
      <ConnectedController />
    </RequirePedal>
  );
}
