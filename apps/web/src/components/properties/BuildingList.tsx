"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Building2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card } from "@/components/ui/card"

export interface Building {
  id: string
  name: string
  code: string
  floorsCount: number
  status: "Active" | "Inactive"
}

interface BuildingListProps {
  propertyId: string
  onSelectBuilding?: (building: Building) => void
}

async function fetchBuildings(propertyId: string): Promise<Building[]> {
  const res = await fetch(`/api/v1/properties/${propertyId}/buildings`)
  if (!res.ok) {
    throw new Error("Failed to fetch buildings")
  }
  const data = await res.json()
  // Support both { data: [...] } and direct array formats
  return Array.isArray(data) ? data : data.data || []
}

export function BuildingList({ propertyId, onSelectBuilding }: BuildingListProps) {
  const { data: buildings, isLoading, error } = useQuery({
    queryKey: ["buildings", propertyId],
    queryFn: () => fetchBuildings(propertyId),
  })

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading buildings...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-8 border-destructive bg-destructive/10">
        <div className="flex flex-col items-center justify-center space-y-2 text-destructive">
          <p className="font-semibold">Error loading buildings</p>
          <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      </Card>
    )
  }

  if (!buildings || buildings.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground opacity-20" />
          <div className="space-y-1">
            <h3 className="font-medium">No buildings found</h3>
            <p className="text-sm text-muted-foreground">
              Get started by adding a new building to this property.
            </p>
          </div>
          <Button className="mt-4" variant="outline">Add Building</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[300px]">Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead className="text-right">Floors</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buildings.map((building) => (
            <TableRow 
              key={building.id} 
              className="group cursor-pointer"
              onClick={() => onSelectBuilding?.(building)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  {building.name}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{building.code}</TableCell>
              <TableCell className="text-right font-medium">{building.floorsCount}</TableCell>
              <TableCell>
                <Badge 
                  variant={building.status === "Active" ? "default" : "secondary"}
                  className={cn(
                    "font-normal",
                    building.status === "Active" ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400" : ""
                  )}
                >
                  {building.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
