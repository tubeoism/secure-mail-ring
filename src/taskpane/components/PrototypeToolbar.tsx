import { makeStyles, shorthands, tokens, Button, Select } from "@fluentui/react-components";

const useStyles = makeStyles({
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding("4px", "8px"),
    ...shorthands.borderBottom("1px", "dashed", tokens.colorNeutralStroke2),
    fontSize: "11px",
    color: tokens.colorNeutralForeground3,
    flexWrap: "wrap",
    gap: "6px",
  },
  label: {
    fontWeight: "bold",
  },
  actions: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
});

export interface PrototypeToolbarProps {
  onToggleEmpty?: (() => void) | undefined;
  isEmptyVariant?: boolean | undefined;
  selectedPreset?: string | undefined;
  onSelectPreset?: ((preset: string) => void) | undefined;
  onSimulateStale?: (() => void) | undefined;
}

/**
 * Prototype dev toolbar containing mock controls for reviewer testing.
 * Consolidates all prototype scaffolding literals per AG-01B requirement 2.
 */
export function PrototypeToolbar({
  onToggleEmpty,
  isEmptyVariant,
  selectedPreset,
  onSelectPreset,
  onSimulateStale,
}: PrototypeToolbarProps) {
  const styles = useStyles();

  return (
    <div className={styles.toolbar}>
      <span className={styles.label}>🛠️ Dev Mock Tools</span>
      <div className={styles.actions}>
        {onToggleEmpty && (
          <Button
            size="small"
            appearance="subtle"
            onClick={onToggleEmpty}
            title="Toggle empty state fixture"
          >
            {isEmptyVariant ? "Reset Fixtures" : "Simulate Empty"}
          </Button>
        )}
        {onSelectPreset && (
          <Select
            size="small"
            value={selectedPreset}
            onChange={(_e, d) => onSelectPreset(d.value)}
            aria-label="Select test email scenario"
          >
            <option value="clean-alpha">Scenario: Clean mail (Ring ALPHA)</option>
            <option value="outsider-warn">Scenario: Outsider warning</option>
            <option value="missing-token">Scenario: Missing token</option>
            <option value="foreign-token">Scenario: Foreign token</option>
          </Select>
        )}
        {onSimulateStale && (
          <Button
            size="small"
            appearance="subtle"
            onClick={onSimulateStale}
            title="Mô phỏng thay đổi nội dung thư khi đang mở pane"
          >
            ⚠️ Đổi mail
          </Button>
        )}
      </div>
    </div>
  );
}
