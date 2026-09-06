import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  CUSTOM_LAYOUT_ID,
  DEFAULT_LAYOUTS,
  DEFAULT_LAYOUT_SETTINGS,
} from "../data/defaultLayouts";
import { useStorageSync } from "../hooks/useStorageSync";
import type { CustomLayout, LayoutSettings } from "../types";
import { GRID_LIMITS, normalizeCustomLayout } from "../utils/gridLayout";
import { getStorageData, setStorageData } from "../utils/storage";
import styles from "./Options.module.scss";

const LAYOUT_SETTINGS_KEY = "layoutSettings";
const STORAGE_KEYS = [LAYOUT_SETTINGS_KEY];

function cloneDefaultSettings(): LayoutSettings {
  return {
    ...DEFAULT_LAYOUT_SETTINGS,
    customLayout: {
      ...DEFAULT_LAYOUT_SETTINGS.customLayout,
      margins: { ...DEFAULT_LAYOUT_SETTINGS.customLayout.margins },
    },
  };
}

export function Options() {
  const [settings, setSettings] = useState<LayoutSettings>(cloneDefaultSettings);
  const [status, setStatus] = useState("Settings are synchronized through Chrome.");
  const isDirtyRef = useRef(false);

  const loadSettings = useCallback(async () => {
    if (isDirtyRef.current) return;

    try {
      const saved = await getStorageData<LayoutSettings>(
        LAYOUT_SETTINGS_KEY,
        DEFAULT_LAYOUT_SETTINGS
      );
      setSettings(saved);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);
  useStorageSync(STORAGE_KEYS, loadSettings);

  const updateCustom = (changes: Partial<CustomLayout>) => {
    isDirtyRef.current = true;
    setSettings((current) => ({
      ...current,
      customLayout: {
        ...current.customLayout,
        ...changes,
      },
    }));
    setStatus("Unsaved changes.");
  };

  const updateMargin = (
    edge: keyof CustomLayout["margins"],
    value: number
  ) => {
    isDirtyRef.current = true;
    setSettings((current) => ({
      ...current,
      customLayout: {
        ...current.customLayout,
        margins: {
          ...current.customLayout.margins,
          [edge]: value,
        },
      },
    }));
    setStatus("Unsaved changes.");
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    const normalized: LayoutSettings = {
      ...settings,
      customLayout: normalizeCustomLayout(settings.customLayout),
    };
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

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Tabs Layout Pro Settings</h1>
          <p>Configure the default grid and spacing used to arrange existing windows.</p>
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
              {DEFAULT_LAYOUTS.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
              <option value={CUSTOM_LAYOUT_ID}>Custom Grid</option>
            </select>
          </label>
        </section>

        <section>
          <h2>Grid and spacing</h2>
          <p className={styles.help}>
            Rows and columns define the Custom Grid. Gap and margins apply to every layout.
          </p>
          <div className={styles.fieldGrid}>
            <NumberField
              label="Rows"
              value={settings.customLayout.rows}
              min={GRID_LIMITS.rows.min}
              max={GRID_LIMITS.rows.max}
              onChange={(rows) => updateCustom({ rows })}
            />
            <NumberField
              label="Columns"
              value={settings.customLayout.columns}
              min={GRID_LIMITS.columns.min}
              max={GRID_LIMITS.columns.max}
              onChange={(columns) => updateCustom({ columns })}
            />
            <NumberField
              label="Gap (px)"
              value={settings.customLayout.gap}
              min={GRID_LIMITS.gap.min}
              max={GRID_LIMITS.gap.max}
              onChange={(gap) => updateCustom({ gap })}
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
                value={settings.customLayout.margins[edge]}
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
        Tabs Layout Pro never creates windows. If the selected grid has fewer slots than
        eligible windows, extra windows remain unchanged.
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
