import { Button } from '@/components/buttons/Button';
import { PageTitle } from '@/components/common/PageTitle';
import { Wrap } from '@/components/layout/Primitives';
import { EmptyState } from '@/components/ui/EmptyState';
import { paths } from '@/routes/paths';

export default function NotFoundPage() {
  return (
    <>
      <PageTitle title="Page not found" />

      <Wrap style={{ paddingTop: 64, paddingBottom: 64 }}>
        <EmptyState
          glyph="🧭"
          title="Page not found"
          description="That link doesn't lead anywhere on TurfChai. It may have moved, or the address was mistyped."
          action={
            <Button variant="primary" to={paths.landing}>
              Back to TurfChai
            </Button>
          }
        />
      </Wrap>
    </>
  );
}
