import { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore, type CategoryEntry } from '@/src/stores/categoriesStore';
import { MAX_CUSTOM_NAME } from '@/src/features/onboarding/categories';

/**
 * One tracked category: its name is edited in place (commit on blur/submit), with
 * a remove control that's disabled when it would empty the list. Renaming keeps
 * the id, so logged stats stay attached to the category under its new label.
 */
function CategoryRow({
  category,
  canRemove,
  onRename,
  onRemove,
}: {
  category: CategoryEntry;
  canRemove: boolean;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState(category.name);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(category.name);
      return;
    }
    onRename(category.id, trimmed);
  }

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    minHeight: t.size.control.lg,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingLeft: t.space[4],
    paddingRight: t.space[2],
  };
  const input: TextStyle = {
    flex: 1,
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.ink,
    paddingVertical: t.space[3],
  };

  return (
    <View style={row}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onEndEditing={commit}
        maxLength={MAX_CUSTOM_NAME}
        returnKeyType="done"
        placeholderTextColor={t.colors.inkSoft}
        accessibilityLabel={`Category name, ${category.name}`}
        style={input}
      />
      <Pressable
        onPress={() => onRemove(category.id)}
        disabled={!canRemove}
        accessibilityRole="button"
        accessibilityLabel={`Stop tracking ${category.name}`}
        accessibilityState={{ disabled: !canRemove }}
        hitSlop={8}
        style={{
          width: t.size.control.md,
          height: t.size.control.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canRemove ? 1 : 0.35,
        }}
      >
        <Ionicons name="close-circle-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
      </Pressable>
    </View>
  );
}

export default function Categories() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useCategoriesStore((s) => s.categories);
  const addCategory = useCategoriesStore((s) => s.addCategory);
  const renameCategory = useCategoriesStore((s) => s.renameCategory);
  const removeCategory = useCategoriesStore((s) => s.removeCategory);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function commitNew() {
    const name = draft.trim();
    if (name) addCategory(name);
    setDraft('');
    setAdding(false);
  }

  const canRemove = categories.length > 1;

  const lead: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const addChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.size.control.lg,
    backgroundColor: t.colors.primarySoft,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.primary,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
  };

  return (
    <Screen edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: t.space[3], paddingTop: t.space[4], paddingBottom: insets.bottom + t.space[6] }}
      >
        <AppText style={lead}>
          The tasks Whenbee learns for you. Rename anything, or remove what you no longer do. Past
          logs stay either way.
        </AppText>

        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            canRemove={canRemove}
            onRename={renameCategory}
            onRemove={removeCategory}
          />
        ))}

        {adding ? (
          <View style={addChip}>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={commitNew}
              onBlur={commitNew}
              placeholder="Name it…"
              placeholderTextColor={t.colors.inkSoft}
              maxLength={MAX_CUSTOM_NAME}
              returnKeyType="done"
              accessibilityLabel="New category name"
              style={{
                flex: 1,
                ...(type.bodyLg as unknown as TextStyle),
                color: t.colors.ink,
                paddingVertical: t.space[3],
              }}
            />
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Chip
              label="+ New category"
              variant="add"
              onPress={() => {
                Keyboard.dismiss();
                setAdding(true);
              }}
            />
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
