import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getResearchQuota } from "@/lib/needs.functions";

/** Live plan + credit balance, kept fresh while the tab is open. */
export function useCreditStatus() {
  const fetchQuota = useServerFn(getResearchQuota);

  return useQuery({
    queryKey: ["research-quota"],
    queryFn: () => fetchQuota({ data: undefined }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}
