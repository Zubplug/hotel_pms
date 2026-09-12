"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  accountId: z.string().min(1, "Please select an account"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface Account {
  id: string;
  name: string;
}

interface NewCityLedgerInvoiceModalProps {
  accounts: Account[];
}

export function NewCityLedgerInvoiceModal({
  accounts,
}: NewCityLedgerInvoiceModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const defaultDueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: "",
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      issueDate: today,
      dueDate: defaultDueDate,
      amount: 0,
      description: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/accountant/city-ledger/invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const body = await response.json();
      if (!response.ok || body.success === false) throw new Error(body.error?.message || body.error || "Failed to create invoice");

      toast.success(`Invoice ${data.invoiceNumber} created successfully`);
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger >
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <FilePlus2 className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Accounts Receivable Invoice</DialogTitle>
          <DialogDescription className="text-slate-400">
            Issue a controlled invoice to the selected city-ledger account.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem><FormLabel className="text-slate-200">Invoice number</FormLabel><FormControl><Input placeholder="INV-2026-0001" className="bg-slate-950 border-white/10 text-slate-200 focus:border-emerald-500" {...field} /></FormControl><FormMessage className="text-rose-400" /></FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="issueDate" render={({ field }) => <FormItem><FormLabel className="text-slate-200">Issue date</FormLabel><FormControl><Input type="date" className="bg-slate-950 border-white/10 text-slate-200" {...field} /></FormControl><FormMessage className="text-rose-400" /></FormItem>} />
              <FormField control={form.control} name="dueDate" render={({ field }) => <FormItem><FormLabel className="text-slate-200">Due date</FormLabel><FormControl><Input type="date" className="bg-slate-950 border-white/10 text-slate-200" {...field} /></FormControl><FormMessage className="text-rose-400" /></FormItem>} />
            </div>
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-slate-950 border-white/10 text-slate-200 focus:ring-emerald-500">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      {accounts.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id}
                          className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white"
                        >
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-rose-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400">
                        ₦
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-8 bg-slate-950 border-white/10 text-slate-200 focus:border-emerald-500"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-rose-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Corporate stay - John Doe"
                      className="bg-slate-950 border-white/10 text-slate-200 focus:border-emerald-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-rose-400" />
                </FormItem>
              )}
            />

            <div className="pt-4 flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="bg-transparent border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Transfer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
