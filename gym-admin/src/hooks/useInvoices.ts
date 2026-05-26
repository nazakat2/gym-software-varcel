import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface Invoice {
  id: string;
  memberId: string;
  memberName?: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceData {
  memberId: string;
  amount: number;
  dueDate: string;
  description?: string;
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  status?: string;
  paidDate?: string;
}

// Fetch all invoices
export function useInvoices(filters?: { status?: string; memberId?: string }) {
  return useQuery({
    queryKey: ["invoices", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.memberId) params.append("memberId", filters.memberId);

      const response = await apiClient.get(`/invoices?${params.toString()}`);
      return response.data.data as Invoice[];
    },
  });
}

// Fetch single invoice by ID
export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const response = await apiClient.get(`/invoices/${id}`);
      return response.data.data as Invoice;
    },
    enabled: !!id,
  });
}

// Create new invoice
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      const response = await apiClient.post("/invoices", data);
      return response.data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// Update invoice
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInvoiceData }) => {
      const response = await apiClient.put(`/invoices/${id}`, data);
      return response.data.data as Invoice;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.id] });
    },
  });
}

// Mark invoice as paid
export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/invoices/${id}/pay`);
      return response.data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// Delete invoice
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// Get invoice statistics
export function useInvoiceStats() {
  return useQuery({
    queryKey: ["invoices", "stats"],
    queryFn: async () => {
      const response = await apiClient.get("/invoices/stats");
      return response.data.data as {
        total: number;
        paid: number;
        pending: number;
        overdue: number;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
      };
    },
  });
}
