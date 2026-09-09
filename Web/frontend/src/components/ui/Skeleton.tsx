interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-secondary/20 ${className}`}
      style={style}
    />
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-responsive">
      <table className="table table-hover mb-0">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx}>
                  <Skeleton className="h-4 w-full" style={{ width: `${60 + Math.random() * 40}%` }} />
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
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
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
      <Skeleton className="h-8 w-64 mb-4" />
      <Skeleton className="h-4 w-96 mb-6" />
      <CardSkeleton count={4} />
      <div className="mt-4">
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  )
}

export function ListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="list-group">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="list-group-item">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-pill" />
          </div>
        </div>
      ))}
    </div>
  )
}
