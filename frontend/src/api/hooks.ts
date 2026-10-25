import { useQuery } from "@tanstack/react-query";
import { http } from "./http";
import type {
  ApplicationView,
  Company,
  CreditProduct,
  Status,
} from "./contract-types";
export const useCreditProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: ({ signal }) =>
      http<CreditProduct[]>("/credit-products", { signal }),
  });
export const useCompany = () =>
  useQuery({
    queryKey: ["company"],
    queryFn: ({ signal }) => http<Company>("/companies/me", { signal }),
  });
export const useApplications = () =>
  useQuery({
    queryKey: ["applications"],
    queryFn: ({ signal }) =>
      http<ApplicationView[]>("/applications", { signal }),
  });
export const useBankApplications = (status?: Status) =>
  useQuery({
    queryKey: ["applications", "bank", status],
    queryFn: ({ signal }) =>
      http<ApplicationView[]>(
        `/bank/applications${status ? `?status=${status}` : ""}`,
        { signal },
      ),
  });
export const useApplication = (id: string) =>
  useQuery({
    queryKey: ["application", id],
    queryFn: ({ signal }) =>
      http<ApplicationView>(`/applications/${id}`, { signal }),
    refetchInterval: (query) =>
      query.state.data?.status === "CHECKING" ? 5000 : false,
  });
