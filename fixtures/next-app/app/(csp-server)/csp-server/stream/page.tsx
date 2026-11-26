import { Suspense } from 'react'
import { Box, Chip, Item, LateCard, Late, List, Pill, ServerFrame, Tag } from '../../parts'

// A page that streams under the policy, in three boundaries: A (400 ms), B (1000 ms), and C inside B (600
// ms after it). The chip's base class is sent with the first piece, its loud props class first in A; the
// tag is shown first in the fallback of A and again in its content; the list, the late card and the box
// come only in a later piece; the pill is used first in A.
export default function CspServerStreamPage() {
  return (
    <ServerFrame testId="page-csp-server-stream" title="Streaming">
      <Chip tone="calm" data-testid="csp-server-chip">
        Early
      </Chip>
      <Suspense fallback={<Tag data-testid="csp-server-fallback">Loading</Tag>}>
        <Late ms={400}>
          <Tag data-testid="csp-server-tag">Tag</Tag>
          <List data-testid="csp-server-stream-list">
            <Item data-testid="csp-server-stream-item-1">One</Item>
            <Item data-testid="csp-server-stream-item-2">Two</Item>
            <Item data-testid="csp-server-stream-item-3">Three</Item>
          </List>
          <Pill size="small" data-testid="csp-server-pill">
            Small
          </Pill>
        </Late>
      </Suspense>
      <Suspense fallback={<p>Loading b</p>}>
        <Late ms={1000}>
          <LateCard data-testid="csp-server-late">
            <Chip tone="loud" data-testid="csp-server-late-chip">
              Late
            </Chip>
          </LateCard>
          <Suspense fallback={<p>Loading c</p>}>
            <Late ms={600}>
              <Box data-testid="csp-server-box">
                <Chip tone="calm" data-testid="csp-server-box-chip">
                  In c
                </Chip>
              </Box>
            </Late>
          </Suspense>
        </Late>
      </Suspense>
    </ServerFrame>
  )
}
