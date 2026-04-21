import { ReactNode, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BorderRadius, Colors, Spacing } from '../../constants/theme'

interface CollapsibleCardProps {
  title: string
  subtitle?: string
  defaultExpanded?: boolean
  forceExpanded?: boolean
  children: ReactNode
}

export function CollapsibleCard({
  title,
  subtitle,
  defaultExpanded = false,
  forceExpanded = false,
  children,
}: CollapsibleCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true)
    }
  }, [forceExpanded])

  return (
    <View style={styles.root}>
      <Pressable style={styles.header} onPress={() => setExpanded(prev => !prev)}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.chevronBadge}>
          <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
        </View>
      </Pressable>

      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerTextBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  chevronBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E6C6A1',
    backgroundColor: '#FFF1E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    color: '#8A4C1B',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  content: {
    gap: Spacing.sm,
  },
})