import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cnic?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  position: string;
  department?: string;
  salary?: number;
  hireDate: string;
  status: string;
  photo?: string;
  emergencyContact?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeData {
  name: string;
  email?: string;
  phone: string;
  cnic?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  position: string;
  department?: string;
  salary?: number;
  hireDate: string;
  photo?: string;
  emergencyContact?: string;
}

export interface UpdateEmployeeData extends Partial<CreateEmployeeData> {
  status?: string;
}

// Fetch all employees
export function useEmployees(filters?: { status?: string; position?: string }) {
  return useQuery({
    queryKey: ["employees", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.position) params.append("position", filters.position);

      const response = await apiClient.get(`/employees?${params.toString()}`);
      return response.data.data as Employee[];
    },
  });
}

// Fetch single employee by ID
export function useEmployee(id: string) {
  return useQuery({
    queryKey: ["employees", id],
    queryFn: async () => {
      const response = await apiClient.get(`/employees/${id}`);
      return response.data.data as Employee;
    },
    enabled: !!id,
  });
}

// Create new employee
export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEmployeeData) => {
      const response = await apiClient.post("/employees", data);
      return response.data.data as Employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

// Update employee
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeData }) => {
      const response = await apiClient.put(`/employees/${id}`, data);
      return response.data.data as Employee;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees", variables.id] });
    },
  });
}

// Delete employee
export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

// Search employees
export function useSearchEmployees(searchTerm: string) {
  return useQuery({
    queryKey: ["employees", "search", searchTerm],
    queryFn: async () => {
      const response = await apiClient.get(`/employees/search?q=${encodeURIComponent(searchTerm)}`);
      return response.data.data as Employee[];
    },
    enabled: searchTerm.length > 0,
  });
}

// Get employee statistics
export function useEmployeeStats() {
  return useQuery({
    queryKey: ["employees", "stats"],
    queryFn: async () => {
      const response = await apiClient.get("/employees/stats");
      return response.data.data as {
        total: number;
        active: number;
        inactive: number;
        byPosition: Record<string, number>;
        totalSalary: number;
      };
    },
  });
}
