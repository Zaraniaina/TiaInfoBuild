interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <span
      className={`placeholder placeholder-glow rounded-1 d-inline-block ${className}`}
      style={{ width: '100%', height: '0.9rem', backgroundColor: 'var(--bs-secondary-color)', opacity: 0.35, ...style }}
    />
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0" aria-hidden="true">
        <thead className="table-light">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton style={{ width: `${45 + ((i * 13) % 40)}%` }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx}>
                  <Skeleton style={{ width: `${50 + ((rowIdx * 17 + colIdx * 29) % 45)}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="row g-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-md-6 col-lg-3">
          <div className="card h-100">
            <div className="card-body">
              <Skeleton className="mb-3" style={{ width: '60%' }} />
              <Skeleton className="mb-2" style={{ width: '40%', height: '1.8rem' }} />
              <Skeleton style={{ width: '80%' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="p-4">
      <Skeleton className="mb-4" style={{ width: '260px', height: '1.6rem' }} />
      <div className="mb-4">
        <CardSkeleton count={4} />
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <TableSkeleton rows={8} columns={5} />
        </div>
      </div>
    </div>
  )
}

export function ListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="list-group" aria-hidden="true">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="list-group-item">
          <div className="d-flex justify-content-between align-items-center">
            <div className="flex-grow-1 me-3">
              <Skeleton className="mb-2" style={{ width: '55%' }} />
              <Skeleton style={{ width: '35%' }} />
            </div>
            <Skeleton style={{ width: '90px', height: '1.4rem', borderRadius: '50rem' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
