import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';

// ──────────────────────────────────────────────────────────────────────────────
// ManageAreaCard — grouped "Manage this area" card at the bottom of a category
// detail screen. Reset (indigo, always shown) + Delete (danger red, hidden when
// `canDelete` is false). Both rows route through the shared ConfirmSheet so a
// destructive action always gets a considered confirm step, never a bare tap.
// ──────────────────────────────────────────────────────────────────────────────

interface ManageAreaCardProps {
  categoryName: string;
  canDelete: boolean;
  onConfirmReset: () => void;
  onConfirmDelete: () => void;
}

export function ManageAreaCard({
  categoryName,
  canDelete,
  onConfirmReset,
  onConfirmDelete,
}: ManageAreaCardProps) {
  const t = useTheme();
  const s = styles(t);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);

  return (
    <View style={s.card}>
      <Text style={s.header}>Manage this area</Text>

      <Pressable
        style={s.row}
        accessibilityRole="button"
        accessibilityLabel="Reset learning"
        onPress={() => setConfirm('reset')}
      >
        <Ionicons name="refresh-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
        <View style={s.rowText}>
          <Text style={s.rowTitle}>Reset learning</Text>
          <Text style={s.rowSub}>Clears the guess history, keeps your honey</Text>
        </View>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </Pressable>

      {canDelete && (
        <Pressable
          style={[s.row, s.rowDivider]}
          accessibilityRole="button"
          accessibilityLabel="Delete area"
          onPress={() => setConfirm('delete')}
        >
          <Ionicons name="trash-outline" size={t.iconSize.sm} color={t.colors.danger} />
          <View style={s.rowText}>
            <Text style={[s.rowTitle, s.rowTitleDanger]}>Delete area</Text>
            <Text style={s.rowSub}>Removes this area and its data</Text>
          </View>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </Pressable>
      )}

      <ConfirmSheet
        visible={confirm === 'reset'}
        tone="caution"
        glyphKind="progress"
        title={`Reset ${categoryName}'s learning?`}
        bullets={[
          'Whenbee starts over learning this area.',
          'Your honey and tier stay — only the guess history resets.',
        ]}
        confirmLabel="Reset"
        cancelLabel="Keep it"
        onConfirm={() => {
          setConfirm(null);
          onConfirmReset();
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmSheet
        visible={confirm === 'delete'}
        tone="danger"
        glyphKind="erase"
        title={`Delete ${categoryName}?`}
        bullets={['Removes this area along with its logs, learning, and goal.', "This can't be undone."]}
        confirmLabel="Delete area"
        cancelLabel="Keep it"
        onConfirm={() => {
          setConfirm(null);
          onConfirmDelete();
        }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

function styles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      overflow: 'hidden',
      marginTop: t.space[5],
    } as ViewStyle,
    header: {
      ...(type.caption as TextStyle),
      color: t.colors.inkFaint,
      letterSpacing: t.letterSpacing.wide,
      textTransform: 'uppercase',
      paddingHorizontal: t.space[4],
      paddingTop: t.space[4],
      paddingBottom: t.space[2],
    } as TextStyle,
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      minHeight: t.size.control.md,
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[3],
    } as ViewStyle,
    rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.hairline } as ViewStyle,
    rowText: { flex: 1 } as ViewStyle,
    rowTitle: { ...(type.body as TextStyle), color: t.colors.ink } as TextStyle,
    rowTitleDanger: { color: t.colors.danger } as TextStyle,
    rowSub: { ...(type.caption as TextStyle), color: t.colors.inkFaint, marginTop: t.space[0.5] } as TextStyle,
  });
}
