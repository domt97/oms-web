import { useMemo, useState } from 'react';
import { useAsync } from '../../../shared/lib/async';
import { useLocation } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Empty, ErrorBox, Select } from '../../../shared/ui/ui';
import { PartialNotice, ProductGrid, ProductGridSkeleton } from '../components';

type Sort = 'newest' | 'price-asc' | 'price-desc';

export function SearchPage() {
  const { catalog } = useServices();
  const { search } = useLocation();
  const q = search.get('q') ?? '';
  const result = useAsync(() => catalog.search(q), [catalog, q]);
  const [sort, setSort] = useState<Sort>('newest');

  const items = useMemo(() => {
    const list = [...(result.data?.items ?? [])];
    const price = (p: { minPrice?: number | null }) => p.minPrice ?? Number.MAX_SAFE_INTEGER;
    if (sort === 'price-asc') list.sort((a, b) => price(a) - price(b));
    if (sort === 'price-desc') list.sort((a, b) => price(b) - price(a));
    return list;
  }, [result.data, sort]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{q ? <>Results for “{q}”</> : 'All products'}</h1>
          {result.data && (
            <div className="sub">
              {items.length} products · searched the newest products of {result.data.shopsSearched} shops (full search arrives with the catalog API)
            </div>
          )}
        </div>
        <label className="row small">
          Sort
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 170 }}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </Select>
        </label>
      </div>
      {result.loading && !result.data ? (
        <ProductGridSkeleton />
      ) : result.error ? (
        <ErrorBox error={result.error} title="Search failed" />
      ) : (
        <div className="stack">
          <PartialNotice result={result.data!} />
          {items.length === 0 ? <Empty>No products match “{q}”. Try another word.</Empty> : <ProductGrid items={items} />}
        </div>
      )}
    </>
  );
}
