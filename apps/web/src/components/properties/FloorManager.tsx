"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronRight, DoorClosed, Plus, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface Room {
  id: string
  name: string
  type: string
  status: "Clean" | "Dirty" | "Maintenance" | "Occupied"
}

export interface Floor {
  id: string
  level: string | number
  name: string
  rooms: Room[]
}

interface FloorManagerProps {
  buildingId: string
  buildingName: string
  floors: Floor[]
}

const statusColors: Record<Room["status"], "default" | "secondary" | "destructive" | "outline"> = {
  Clean: "default",
  Occupied: "secondary",
  Dirty: "destructive",
  Maintenance: "outline",
}

export function FloorManager({ buildingName, floors }: FloorManagerProps) {
  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="border-b bg-muted/40 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {buildingName} - Floors & Rooms
            </CardTitle>
            <CardDescription className="mt-1">
              Manage floors and view room availability in real-time.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Floor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {floors.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Layers className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No floors found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add a floor to get started managing this building.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {floors.map((floor) => (
              <FloorAccordionItem key={floor.id} floor={floor} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FloorAccordionItem({ floor }: { floor: Floor }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex flex-col group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
            isOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20"
          )}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Level {floor.level}</span>
            <span className="text-muted-foreground text-sm">- {floor.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-normal text-xs">
            {floor.rooms.length} Rooms
          </Badge>
          <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-0 pl-[3.25rem] bg-muted/10 pb-4">
            {floor.rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No rooms on this floor.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {floor.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-background shadow-sm hover:shadow-md transition-shadow group/room"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md text-muted-foreground group-hover/room:text-primary transition-colors">
                        <DoorClosed className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{room.name}</div>
                        <div className="text-xs text-muted-foreground">{room.type}</div>
                      </div>
                    </div>
                    <Badge variant={statusColors[room.status]} className="text-[10px] px-1.5 py-0">
                      {room.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
