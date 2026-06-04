"use client";

import { useCallback } from "react";
import { getStudentsByGroup, listGroups } from "@/services/students";
import type { Group, Student } from "@/types";
import { useAsyncQuery } from "./useAsyncQuery";

export function useGroups() {
  const loader = useCallback(() => listGroups(), []);
  return useAsyncQuery<Group[]>(loader, []);
}

export function useStudents(groupId: string | null) {
  const loader = useCallback(() => {
    if (!groupId) return Promise.resolve([] as Student[]);
    return getStudentsByGroup(groupId);
  }, [groupId]);

  return useAsyncQuery<Student[]>(loader, [groupId]);
}
