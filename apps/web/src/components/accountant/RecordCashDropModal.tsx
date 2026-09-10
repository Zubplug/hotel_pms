"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be a positive number" }),
  drawerId: z.string().min(1, { message: "Drawer is required" }),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PosSession {
  id: string;
  outlet?: { name: string } | null;
  primaryOperator?: { firstName: string; lastName: string } | null;
}

interface RecordCashDropModalProps {
  posSessions: PosSession[];
}

export function RecordCashDropModal({ posSessions }: RecordCashDropModalProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      drawerId: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const response = await fetch("/api/v1/accountant/cash-bank/drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to record cash drop");
      }

      toast.success("Cash drop recorded successfully");
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger >
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Record Cash Drop
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Record Cash Drop</DialogTitle>
          <DialogDescription className="text-slate-400">
            Record a cash drop from a drawer to the bank.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="drawerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Drawer</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-950 border-white/10 text-white">
                        <SelectValue placeholder="Select a drawer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      {posSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id} className="focus:bg-slate-800 focus:text-white">
                          {session.id.substring(0, 8)} - {session.outlet?.name || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Amount (₦)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-slate-950 border-white/10 text-white"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      className="bg-slate-950 border-white/10 text-white"
                      placeholder="Add any notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent border-white/10 text-white hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {form.formState.isSubmitting ? "Saving..." : "Record Drop"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
