import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName?: string;
  checkInTime: string;
  checkOutTime?: string;
  date: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttendanceData {
  memberId: string;
  checkInTime?: string;
  date?: string;
}

export interface UpdateAttendanceData {
  checkOutTime?: string;
  status?: string;
}

// Fetch attendance records
export function useAttendance(filters?: {
  date?: string;
  memberId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["attendance", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.date) params.append("date", filters.date);
      if (filters?.memberId) params.append("memberId", filters.memberId);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);

      const response = await apiClient.get(`/attendance?${params.toString()}`);
      return response.data.data as AttendanceRecord[];
    },
  });
}

// Fetch single attendance record
export function useAttendanceRecord(id: string) {
  return useQuery({
    queryKey: ["attendance", id],
    queryFn: async () => {
      const response = await apiClient.get(`/attendance/${id}`);
      return response.data.data as AttendanceRecord;
    },
    enabled: !!id,
  });
}

// Check-in member
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAttendanceData) => {
      const response = await apiClient.post("/attendance/check-in", data);
      return response.data.data as AttendanceRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "stats"] });
    },
  });
}

// Check-out member
export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/attendance/${id}/check-out`);
      return response.data.data as AttendanceRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "stats"] });
    },
  });
}

// Update attendance record
export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAttendanceData }) => {
      const response = await apiClient.put(`/attendance/${id}`, data);
      return response.data.data as AttendanceRecord;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", variables.id] });
    },
  });
}

// Delete attendance record
export function useDeleteAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/attendance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// Get attendance statistics
export function useAttendanceStats(date?: string) {
  return useQuery({
    queryKey: ["attendance", "stats", date],
    queryFn: async () => {
      const params = date ? `?date=${date}` : "";
      const response = await apiClient.get(`/attendance/stats${params}`);
      return response.data.data as {
        totalCheckIns: number;
        activeMembers: number;
        averageStayTime: number;
        peakHour: string;
      };
    },
  });
}

// Get member attendance history
export function useMemberAttendanceHistory(memberId: string, limit?: number) {
  return useQuery({
    queryKey: ["attendance", "member", memberId, limit],
    queryFn: async () => {
      const params = limit ? `?limit=${limit}` : "";
      const response = await apiClient.get(`/attendance/member/${memberId}${params}`);
      return response.data.data as AttendanceRecord[];
    },
    enabled: !!memberId,
  });
}
