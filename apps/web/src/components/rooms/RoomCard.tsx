"use client";

import React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Users, User, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRoomNumber } from "@/lib/format-room";

export interface Room {
  id: string;
  number: string;
  status: string;
  housekeepingStatus: string;
  maxAdults: number;
  maxChildren: number;
  roomType?: {
    name: string;
    code: string;
  };
  floor?: {
    name: string;
    number: number;
  };
  building?: {
    name: string;
  };
}

interface RoomCardProps {
  room: Room;
  className?: string;
}

export function RoomCard({ room, className }: RoomCardProps) {
  return (
    <Card 
      className={cn(
        "group relative overflow-hidden flex flex-col justify-between transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1 hover:border-primary/50",
        "bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {room.roomType?.name || "Standard"}
          </span>
          <h3 className="text-3xl font-bold tracking-tight mt-1">{formatRoomNumber(room.number)}</h3>
        </div>
        <StatusBadge status={room.status} />
      </CardHeader>
      
      <CardContent className="px-5 py-4 flex-grow">
        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5" title={`Max Adults: ${room.maxAdults}`}>
            <User className="w-4 h-4" />
            <span className="font-medium text-foreground">{room.maxAdults} Adult</span>
          </div>
          {room.maxChildren > 0 && (
            <div className="flex items-center gap-1.5" title={`Max Children: ${room.maxChildren}`}>
              <Users className="w-4 h-4 text-muted-foreground/70" />
              <span className="font-medium text-foreground">{room.maxChildren} Child</span>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="px-5 pb-5 pt-0 flex items-center justify-between text-sm relative z-10">
        <div className="flex items-center text-muted-foreground gap-1.5 bg-secondary/50 rounded-full px-3 py-1">
          <ArrowUpCircle className="w-4 h-4" />
          <span>Floor {room.floor?.name || room.floor?.number || "1"}</span>
        </div>
        
        {/* Quick action button that appears on hover */}
        <button className="text-primary font-medium opacity-0 transform translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
          Details &rarr;
        </button>
      </CardFooter>
    </Card>
  );
}
