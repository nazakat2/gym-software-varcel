import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface Member {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cnic?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContact?: string;
  membershipType?: string;
  membershipStartDate?: string;
  membershipEndDate?: string;
  status: string;
  photo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberData {
  name: string;
  email?: string;
  phone: string;
  cnic?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContact?: string;
  membershipType?: string;
  membershipStartDate?: string;
  membershipEndDate?: string;
  photo?: string;
}

export interface UpdateMemberData extends Partial<CreateMemberData> {
  status?: string;
}

// Fetch all members
export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const response = await apiClient.get("/members");
      return response.data.data as Member[];
    },
  });
}

// Fetch single member by ID
export function useMember(id: string) {
  return useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      const response = await apiClient.get(`/members/${id}`);
      return response.data.data as Member;
    },
    enabled: !!id,
  });
}

// Create new member
export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMemberData) => {
      const response = await apiClient.post("/members", data);
      return response.data.data as Member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// Update member
export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMemberData }) => {
      const response = await apiClient.put(`/members/${id}`, data);
      return response.data.data as Member;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members", variables.id] });
    },
  });
}

// Delete member
export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// Search members
export function useSearchMembers(searchTerm: string) {
  return useQuery({
    queryKey: ["members", "search", searchTerm],
    queryFn: async () => {
      const response = await apiClient.get(`/members/search?q=${encodeURIComponent(searchTerm)}`);
      return response.data.data as Member[];
    },
    enabled: searchTerm.length > 0,
  });
}
