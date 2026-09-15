'use client';

import React from 'react';
import { Card } from '@/components/ui/card';

// Config
const START_HOUR = 8;
const END_HOUR = 22; // 10 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

export function EventTimeline({ halls, bookings }: { halls: any[], bookings: any[] }) {
  
  // Helper to calculate left % and width % based on time
  const getStyleForBooking = (startTime: Date, endTime: Date) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Normalize to today's grid (assuming all bookings passed in are for "today" or a specific viewed day)
    // For simplicity, we just use the hour and minutes
    const startDecimal = start.getHours() + start.getMinutes() / 60;
    const endDecimal = end.getHours() + end.getMinutes() / 60;
    
    const totalHours = END_HOUR - START_HOUR + 1;
    
    // If it starts before the grid, cap it at 0
    const effectiveStart = Math.max(startDecimal - START_HOUR, 0);
    const effectiveEnd = Math.min(endDecimal - START_HOUR, totalHours);
    
    const duration = effectiveEnd - effectiveStart;
    
    return {
      left: `${(effectiveStart / totalHours) * 100}%`,
      width: `${(duration / totalHours) * 100}%`,
    };
  };

  return (
    <Card className="w-full overflow-hidden border">
      <div className="flex overflow-x-auto">
        {/* Resource Column */}
        <div className="w-48 flex-none border-r bg-slate-50 sticky left-0 z-20">
          <div className="h-12 border-b flex items-center px-4 font-medium text-xs text-muted-foreground uppercase">
            Spaces
          </div>
          {halls.map(hall => (
            <div key={hall.id} className="h-20 border-b flex flex-col justify-center px-4 bg-white">
              <span className="font-medium text-sm truncate">{hall.name}</span>
            </div>
          ))}
        </div>

        {/* Timeline Grid */}
        <div className="flex-1 min-w-[800px]">
          <div className="flex h-12 border-b bg-slate-50">
            {HOURS.map(hour => (
              <div key={hour} className="flex-1 flex items-center justify-start px-2 border-r text-xs text-muted-foreground">
                {hour}:00
              </div>
            ))}
          </div>
          
          <div className="relative">
            {halls.map((hall) => {
              const hallBookings = bookings.filter(b => b.hallId === hall.id);
              
              return (
                <div key={hall.id} className="flex h-20 border-b relative">
                  {/* Background Grid Lines */}
                  {HOURS.map(hour => (
                    <div key={hour} className="flex-1 border-r border-dashed opacity-50" />
                  ))}

                  {/* Real Event Blocks */}
                  {hallBookings.map(booking => {
                    const style = getStyleForBooking(booking.startTime, booking.endTime);
                    const isSetup = false; // Could render a separate block for setup buffers
                    
                    return (
                      <div 
                        key={booking.id}
                        className="absolute h-[70%] top-[15%] bg-blue-100 border border-blue-300 rounded px-3 py-1 overflow-hidden shadow-sm"
                        style={style}
                        title={`Event: ${booking.event?.name}\nTime: ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`}
                      >
                        <div className="text-xs font-bold text-blue-900 truncate">{booking.event?.name || 'Booking'}</div>
                        <div className="text-[10px] text-blue-700 truncate">
                          {new Date(booking.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                          {new Date(booking.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
