import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LoadingTableProps = {
  columns: Array<string>
  rows?: number
  className?: string
}

export function LoadingTable({
  columns,
  rows = 6,
  className,
}: LoadingTableProps) {
  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={`loading-row-${rowIndex}`}>
              {columns.map((column, columnIndex) => (
                <TableCell key={`${column}-${columnIndex}`}>
                  <Skeleton
                    className={`h-4 ${
                      columnIndex === 0
                        ? "w-16"
                        : columnIndex === columns.length - 1
                          ? "w-20"
                          : "w-full max-w-[180px]"
                    }`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
