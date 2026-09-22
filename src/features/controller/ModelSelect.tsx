import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FxModel } from "@/device/catalog";
import { cn } from "@/lib/utils";

const SEARCHABLE_THRESHOLD = 15;

function matchesModelQuery(option: FxModel, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return (
    option.label.toLowerCase().includes(trimmed) ||
    option.id.toLowerCase().includes(trimmed) ||
    (option.basedOn?.toLowerCase().includes(trimmed) ?? false)
  );
}

function ModelOptionLabel({ option }: { option: FxModel }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
      <span>{option.label}</span>
      {option.basedOn ? (
        <span className="text-xs text-muted-foreground/60">{option.basedOn}</span>
      ) : null}
    </span>
  );
}

function SimpleModelSelect({
  value,
  options,
  disabled,
  ariaLabel,
  onValueChange,
}: {
  value: string;
  options: readonly FxModel[];
  disabled?: boolean;
  ariaLabel: string;
  onValueChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <Select value={value} disabled={disabled} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        size="sm"
        className="h-8 w-full min-w-52 flex-1"
      >
        <SelectValue>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem
            key={option.id}
            value={option.id}
            className={option.basedOn ? "items-start py-2" : "py-2"}
          >
            <ModelOptionLabel option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchableModelSelect({
  value,
  options,
  disabled,
  ariaLabel,
  onValueChange,
}: {
  value: string;
  options: readonly FxModel[];
  disabled?: boolean;
  ariaLabel: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeOption, setActiveOption] = useState(value);
  const activeRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.id === value);

  const filtered = useMemo(
    () => options.filter((option) => matchesModelQuery(option, query)),
    [options, query],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveOption(value);
  }, [open, value]);

  useEffect(() => {
    if (!open || filtered.length === 0) {
      return;
    }
    if (!filtered.some((option) => option.id === activeOption)) {
      const fallback =
        filtered.find((option) => option.id === value) ?? filtered[0];
      if (fallback) {
        setActiveOption(fallback.id);
      }
    }
  }, [activeOption, filtered, open, value]);

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
    const current = filtered.findIndex((option) => option.id === activeOption);
    const from = current >= 0 ? current : 0;
    const next = (from + delta + filtered.length) % filtered.length;
    setActiveOption(filtered[next]!.id);
  }

  function acceptActive() {
    if (!filtered.some((option) => option.id === activeOption)) {
      return;
    }
    onValueChange(activeOption);
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
          setActiveOption(filtered[0].id);
        }
        break;
      case "End":
        event.preventDefault();
        if (filtered.length > 0) {
          setActiveOption(filtered[filtered.length - 1]!.id);
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
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className="h-8 w-full min-w-52 flex-1 justify-between px-2.5 font-normal"
        >
          <span className="min-w-0 truncate">{selected?.label}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) gap-0 p-0"
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
            placeholder="Search model…"
            aria-label="Search model"
            aria-activedescendant={
              filtered.some((option) => option.id === activeOption)
                ? `model-option-${activeOption}`
                : undefined
            }
            className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="max-h-72 overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No model found.
            </p>
          ) : (
            filtered.map((option) => {
              const isSelected = option.id === value;
              const active = option.id === activeOption;
              return (
                <button
                  key={option.id}
                  id={`model-option-${option.id}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  ref={active ? activeRef : undefined}
                  className={cn(
                    "relative flex w-full cursor-default items-center gap-1.5 py-2 pr-8 pl-1.5 text-left text-sm outline-hidden select-none",
                    option.basedOn && "items-start",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onMouseEnter={() => {
                    setActiveOption(option.id);
                  }}
                  onClick={() => {
                    onValueChange(option.id);
                    setOpen(false);
                  }}
                >
                  <ModelOptionLabel option={option} />
                  {isSelected ? (
                    <CheckIcon className="pointer-events-none absolute right-2 top-2.5 size-4" />
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

export function ModelSelect({
  value,
  options,
  disabled,
  ariaLabel,
  onValueChange,
}: {
  value: string;
  options: readonly FxModel[];
  disabled?: boolean;
  ariaLabel: string;
  onValueChange: (value: string) => void;
}) {
  if (options.length > SEARCHABLE_THRESHOLD) {
    return (
      <SearchableModelSelect
        value={value}
        options={options}
        disabled={disabled}
        ariaLabel={ariaLabel}
        onValueChange={onValueChange}
      />
    );
  }

  return (
    <SimpleModelSelect
      value={value}
      options={options}
      disabled={disabled}
      ariaLabel={ariaLabel}
      onValueChange={onValueChange}
    />
  );
}
