import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
} from "@/device/session";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

function matchesPatchQuery(
  option: number,
  name: string | null | undefined,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  const id = formatPatch(option);
  const label = formatPatchOption(option, name ?? null).toLowerCase();
  return (
    id.includes(trimmed) ||
    label.includes(trimmed) ||
    String(option).includes(trimmed) ||
    (name?.toLowerCase().includes(trimmed) ?? false)
  );
}

export function PatchSelect({
  patch,
  patchNames,
  disabled,
  triggerClassName,
  wrapTrigger,
  onSelect,
}: {
  patch: number;
  patchNames: (string | null)[];
  disabled?: boolean;
  triggerClassName?: string;
  wrapTrigger?: (trigger: ReactElement) => ReactNode;
  onSelect: (patch: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeOption, setActiveOption] = useState(patch);
  const activeRef = useRef<HTMLButtonElement>(null);
  const currentName = patchNames[patch];
  const label = currentName
    ? formatPatchOption(patch, currentName)
    : formatPatch(patch);

  const filtered = useMemo(
    () =>
      patchOptions.filter((option) =>
        matchesPatchQuery(option, patchNames[option], query),
      ),
    [patchNames, query],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveOption(patch);
  }, [open, patch]);

  useEffect(() => {
    if (!open || filtered.length === 0) {
      return;
    }
    if (!filtered.includes(activeOption)) {
      setActiveOption(filtered.includes(patch) ? patch : filtered[0]!);
    }
  }, [activeOption, filtered, open, patch]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [activeOption, open, filtered]);

  function moveActive(delta: number) {
    if (filtered.length === 0) {
      return;
    }
    const current = filtered.indexOf(activeOption);
    const from = current >= 0 ? current : 0;
    const next = (from + delta + filtered.length) % filtered.length;
    setActiveOption(filtered[next]!);
  }

  function acceptActive() {
    if (!filtered.includes(activeOption)) {
      return;
    }
    onSelect(activeOption);
    setOpen(false);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        if (filtered[0] !== undefined) {
          setActiveOption(filtered[0]);
        }
        break;
      case "End":
        event.preventDefault();
        if (filtered.length > 0) {
          setActiveOption(filtered[filtered.length - 1]!);
        }
        break;
      case "Enter":
        event.preventDefault();
        acceptActive();
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  }

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      role="combobox"
      aria-expanded={open}
      aria-label="Select patch"
      disabled={disabled}
      className={triggerClassName}
    >
      <span className="min-w-0 flex-1 truncate text-center">{label}</span>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
    </Button>
  );

  const triggerWithPopover = (
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled && next) {
          return;
        }
        setOpen(next);
      }}
    >
      {wrapTrigger ? wrapTrigger(triggerWithPopover) : triggerWithPopover}
      <PopoverContent
        align="center"
        className="w-56 gap-0 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const input = (event.currentTarget as HTMLElement).querySelector(
            "input",
          );
          input?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Search patch…"
            aria-label="Search patch"
            aria-activedescendant={
              filtered.includes(activeOption)
                ? `patch-option-${activeOption}`
                : undefined
            }
            className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div role="listbox" aria-label="Patches" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No patch found.
            </p>
          ) : (
            filtered.map((option) => {
              const selected = option === patch;
              const active = option === activeOption;
              return (
                <button
                  key={option}
                  id={`patch-option-${option}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  ref={active ? activeRef : undefined}
                  className={`relative flex w-full cursor-default items-center gap-1.5 py-1.5 pr-8 pl-1.5 text-left text-sm font-medium tabular-nums outline-hidden select-none ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onMouseEnter={() => {
                    setActiveOption(option);
                  }}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  {formatPatchOption(option, patchNames[option])}
                  {selected ? (
                    <CheckIcon className="pointer-events-none absolute right-2 size-4" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
