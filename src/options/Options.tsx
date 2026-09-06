import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createDefaultLayoutSettings } from "../data/defaultLayouts";
import { useStorageSync } from "../hooks/useStorageSync";
import type { LayoutMargins, LayoutSettings } from "../types";
import {
  GRID_LIMITS,
  layoutHasOverlaps,
  normalizeLayoutSettings,
  parseLayoutCollection,
} from "../utils/gridLayout";
import { getStorageData, setStorageData } from "../utils/storage";
import styles from "./Options.module.scss";

const LAYOUT_SETTINGS_KEY = "layoutSettings";
const STORAGE_KEYS = [LAYOUT_SETTINGS_KEY];

function cloneDefaultSettings(): LayoutSettings {
  return createDefaultLayoutSettings();
}

export function Options() {
  const [settings, setSettings] = useState<LayoutSettings>(cloneDefaultSettings);
  const [status, setStatus] = useState("Settings are synchronized through Chrome.");
  const isDirtyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    if (isDirtyRef.current) return;

    try {
      const saved = await getStorageData<unknown>(
        LAYOUT_SETTINGS_KEY,
        createDefaultLayoutSettings()
      );
      setSettings(normalizeLayoutSettings(saved));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);
  useStorageSync(STORAGE_KEYS, loadSettings);

  const updateGap = (gap: number) => {
    isDirtyRef.current = true;
    setSettings((current) => ({
      ...current,
      gap,
    }));
    setStatus("Unsaved changes.");
  };

  const updateMargin = (edge: keyof LayoutMargins, value: number) => {
    isDirtyRef.current = true;
    setSettings((current) => ({
      ...current,
      margins: {
        ...current.margins,
        [edge]: value,
      },
    }));
    setStatus("Unsaved changes.");
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeLayoutSettings(settings);
    try {
      await setStorageData(LAYOUT_SETTINGS_KEY, normalized);
      isDirtyRef.current = false;
      setSettings(normalized);
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings.");
    }
  };

  const resetSettings = async () => {
    const defaults = cloneDefaultSettings();
    try {
      await setStorageData(LAYOUT_SETTINGS_KEY, defaults);
      isDirtyRef.current = false;
      setSettings(defaults);
      setStatus("Defaults restored.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore defaults.");
    }
  };

  const exportLayouts = () => {
    const blob = new Blob([`${JSON.stringify(settings.layouts, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tabs-layout-pro-layouts.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${settings.layouts.length} layouts.`);
  };

  const importLayouts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const layouts = parseLayoutCollection(JSON.parse(await file.text()));
      const overlappingLayoutCount = layouts.filter(layoutHasOverlaps).length;
      isDirtyRef.current = true;
      setSettings((current) => ({
        ...current,
        layouts,
        selectedLayoutId: layouts.some(
          (layout) => layout.id === current.selectedLayoutId
        )
          ? current.selectedLayoutId
          : layouts[0].id,
      }));
      setStatus(
        `Imported ${layouts.length} layouts. ` +
          (overlappingLayoutCount > 0
            ? `Warning: ${overlappingLayoutCount} contain overlapping windows. `
            : "") +
          "Save to apply changes."
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? `Import failed: ${error.message}` : "Import failed."
      );
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Tabs Layout Pro Settings</h1>
          <p>Configure layouts and spacing used to arrange existing windows.</p>
        </div>
      </header>

      <form className={styles.card} onSubmit={(event) => void saveSettings(event)}>
        <section>
          <h2>Default layout</h2>
          <label className={styles.field}>
            <span>Layout used by the keyboard shortcut</span>
            <select
              value={settings.selectedLayoutId}
              onChange={(event) => {
                isDirtyRef.current = true;
                setSettings((current) => ({
                  ...current,
                  selectedLayoutId: event.target.value,
                }));
                setStatus("Unsaved changes.");
              }}
            >
              {settings.layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h2>Layout configuration</h2>
          <p className={styles.help}>
            Importing replaces all layouts. Changes take effect after you save settings.
          </p>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={exportLayouts}
            >
              Export JSON
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <span className={styles.layoutCount}>
              {settings.layouts.length} layout
              {settings.layouts.length === 1 ? "" : "s"}
            </span>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept=".json,application/json"
              onChange={(event) => void importLayouts(event)}
            />
          </div>
        </section>

        <section>
          <h2>Spacing</h2>
          <p className={styles.help}>
            Gap and margins apply to every imported layout.
          </p>
          <div className={styles.fieldGrid}>
            <NumberField
              label="Gap (px)"
              value={settings.gap}
              min={GRID_LIMITS.gap.min}
              max={GRID_LIMITS.gap.max}
              onChange={updateGap}
            />
          </div>
        </section>

        <section>
          <h2>Screen margins</h2>
          <p className={styles.help}>
            Insets are measured from the active monitor's available work area.
          </p>
          <div className={styles.fieldGrid}>
            {(["top", "right", "bottom", "left"] as const).map((edge) => (
              <NumberField
                key={edge}
                label={`${edge[0].toUpperCase()}${edge.slice(1)} (px)`}
                value={settings.margins[edge]}
                min={GRID_LIMITS.margin.min}
                max={GRID_LIMITS.margin.max}
                onChange={(value) => updateMargin(edge, value)}
              />
            ))}
          </div>
        </section>

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryButton}>
            Save Settings
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void resetSettings()}
          >
            Restore Defaults
          </button>
          <span className={styles.status}>{status}</span>
        </div>
      </form>

      <aside className={styles.note}>
        Tabs Layout Pro never creates windows. If the selected layout has fewer slots
        than eligible windows, extra windows remain unchanged.
      </aside>
    </main>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
