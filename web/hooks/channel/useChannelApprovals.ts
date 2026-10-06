"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  approveApproval,
  rejectApproval,
  type Approval,
} from "@/lib/api/approvals";

export function useChannelApprovals() {
  const [approvals, setApprovals] =
    useState<Approval[]>([]);

  const addApproval = useCallback(
    (approval: Approval) => {
      setApprovals((current) => {
        const alreadyExists =
          current.some(
            (item) =>
              item.id === approval.id,
          );

        if (alreadyExists) {
          return current;
        }

        return [
          ...current,
          approval,
        ];
      });
    },
    [],
  );

  const removeApproval = useCallback(
    (approvalId: string) => {
      setApprovals((current) =>
        current.filter(
          (item) =>
            item.id !== approvalId,
        ),
      );
    },
    [],
  );

  const approve = useCallback(
    async (approvalId: string) => {
      await approveApproval(
        approvalId,
      );

      removeApproval(approvalId);
    },
    [removeApproval],
  );

  const reject = useCallback(
    async (approvalId: string) => {
      await rejectApproval(
        approvalId,
      );

      removeApproval(approvalId);
    },
    [removeApproval],
  );

  return {
    approvals,
    addApproval,
    removeApproval,
    approve,
    reject,
  };
}
