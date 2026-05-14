import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

type AuditPayload = {
  id: string;
  domain: string;
  status: string;
  created_at?: string | null;
  completed_at?: string | null;
  sections?: unknown;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica' },
  h1: { fontSize: 22, marginBottom: 4 },
  meta: { fontSize: 10, color: '#666', marginBottom: 16 },
  h2: { fontSize: 16, marginTop: 16, marginBottom: 6 },
  p: { fontSize: 11, lineHeight: 1.45 },
});

export function AuditReportPdf({ audit }: { audit: AuditPayload }) {
  const s = (audit.sections ?? {}) as Record<string, any>;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{audit.domain}</Text>
        <Text style={styles.meta}>
          SEO+GEO audit ·{' '}
          {new Date(audit.completed_at ?? audit.created_at ?? Date.now())
            .toISOString()
            .slice(0, 10)}
        </Text>

        {s.description?.summary && (
          <View>
            <Text style={styles.h2}>Overview</Text>
            <Text style={styles.p}>{s.description.summary}</Text>
          </View>
        )}

        {s.onsite && (
          <View>
            <Text style={styles.h2}>On-site</Text>
            <Text style={styles.p}>
              Pages crawled: {s.onsite.pages_crawled?.length ?? 0}. Issues:{' '}
              {s.onsite.issues?.length ?? 0}.
            </Text>
            {(s.onsite.issues ?? []).slice(0, 10).map((i: any, idx: number) => (
              <Text key={idx} style={styles.p}>
                • [{i.severity}] {i.message}
              </Text>
            ))}
          </View>
        )}

        {s.offsite && (
          <View>
            <Text style={styles.h2}>Off-site</Text>
            <Text style={styles.p}>{JSON.stringify(s.offsite).slice(0, 800)}…</Text>
          </View>
        )}

        {s.geo && (
          <View>
            <Text style={styles.h2}>GEO visibility</Text>
            <Text style={styles.p}>Score: {s.geo.score ?? '—'}/8</Text>
          </View>
        )}

        {s.competitors && (
          <View>
            <Text style={styles.h2}>Competitors</Text>
            <Text style={styles.p}>
              {(s.competitors.enriched ?? []).map((c: any) => c.domain).join(', ')}
            </Text>
          </View>
        )}

        {s.article_recommendations && (
          <View>
            <Text style={styles.h2}>Article recommendations</Text>
            {(s.article_recommendations.recommendations ?? [])
              .slice(0, 8)
              .map((r: any, idx: number) => (
                <Text key={idx} style={styles.p}>
                  • {r.title}
                </Text>
              ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
