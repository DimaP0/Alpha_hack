import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect } from "vitest";
import { AppRoutes } from "../App";
import { AuthProvider } from "../features/auth";
import { session, ApiError } from "../api/http";
import { FinancialHistoryEditor, validateFinancials } from "../pages/Company";
import { DecisionPanel } from "../pages/Applications";
import { ErrorNotice, ScoreSummary } from "../components/common";
import { application, company, product, respond, simulation } from "./fixtures";
import type { ApplicationView, Role } from "../api/contract-types";
function wrapper(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function renderRoute(
  path: string,
  role: Role = "ENTREPRENEUR",
  handler?: (path: string, init?: RequestInit) => Response | Promise<Response>,
) {
  if (path !== "/login") session.set("test-token");
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/v1/auth/me")
        return respond({
          id: 1,
          email: "test@demo.local",
          fullName: "Демо Пользователь",
          role,
          companyId: role === "ENTREPRENEUR" ? 1 : null,
        });
      if (url === "/api/v1/credit-products") return respond([product]);
      if (url === "/api/v1/companies/me") return respond(company);
      if (
        url === "/api/v1/applications" &&
        (!init?.method || init.method === "GET")
      )
        return respond([]);
      if (url === "/api/v1/bank/applications") return respond([]);
      return (
        handler?.(url, init) ||
        respond({ code: "NOT_FOUND", message: "Not found", details: {} }, 404)
      );
    });
  render(
    wrapper(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    ),
  );
  return fetcher;
}
describe("Authentication and role routes", () => {
  it("submits login credentials, validates session and opens entrepreneur dashboard", async () => {
    const fetcher = renderRoute("/login", "ENTREPRENEUR", (url) =>
      url === "/api/v1/auth/login"
        ? respond({
            accessToken: "signed-token",
            tokenType: "Bearer",
            role: "ENTREPRENEUR",
            fullName: "Demo",
          })
        : respond({}),
    );
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    expect(
      await screen.findByRole("heading", { name: company.name }),
    ).toBeInTheDocument();
    const call = fetcher.mock.calls.find(
      ([url]) => url === "/api/v1/auth/login",
    );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      email: "owner@demo.local",
      password: "Demo123!",
    });
    expect(session.get()).toBe("signed-token");
  });
  it("redirects bank officer away from entrepreneur route", async () => {
    renderRoute("/app/twin", "BANK_OFFICER");
    expect(
      await screen.findByRole("heading", {
        name: "Решения, подкреплённые данными",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Рассчитать сценарии")).not.toBeInTheDocument();
  });
  it("clears authenticated session on API 401", async () => {
    renderRoute("/app/applications/1", "ENTREPRENEUR", () =>
      respond({ code: "UNAUTHORIZED", message: "Expired", details: {} }, 401),
    );
    expect(
      await screen.findByRole("button", { name: "Войти" }),
    ).toBeInTheDocument();
    expect(session.get()).toBeNull();
  });
  it("allows logout after failed startup session check", async () => {
    session.set("old-token");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Network down"),
    );
    render(
      wrapper(
        <MemoryRouter initialEntries={["/app"]}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
    expect(
      await screen.findByText("Не удалось проверить сессию"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(
      await screen.findByRole("button", { name: "Войти" }),
    ).toBeInTheDocument();
    expect(session.get()).toBeNull();
  });
});
describe("Financial editor", () => {
  it("validates 12 consecutive unique months and rejects negative/fractional amounts", () => {
    expect(validateFinancials(company)).toBeNull();
    expect(
      validateFinancials({
        ...company,
        financials: company.financials.slice(1),
      }),
    ).toMatch("12");
    expect(
      validateFinancials({
        ...company,
        financials: company.financials.map((r) => ({ ...r, month: "2025-01" })),
      }),
    ).toMatch("уникальными");
    expect(validateFinancials({ ...company, cashBalanceRub: -1 })).toMatch(
      "неотрицательными",
    );
    expect(
      validateFinancials({
        ...company,
        financials: company.financials.map((r) => ({ ...r, revenueRub: 0.5 })),
      }),
    ).toMatch("целыми");
  });
  it("saves edited twelve-month form using only contract fields", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(respond({ ...company, financialsVersion: 2 }));
    render(wrapper(<FinancialHistoryEditor company={company} />));
    fireEvent.change(screen.getByLabelText("Выручка 1"), {
      target: { value: "2300000" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить финансовые данные" }),
    );
    expect(
      await screen.findByText("Финансовые данные сохранены"),
    ).toBeInTheDocument();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
      financials: { revenueRub: number }[];
    };
    expect(Object.keys(body).sort()).toEqual([
      "cashBalanceRub",
      "existingDebtMonthlyRub",
      "financials",
    ]);
    expect(body.financials).toHaveLength(12);
    expect(body.financials[0].revenueRub).toBe(2300000);
  });
});
describe("Twin and application flow", () => {
  it("renders three scenarios, creates draft, submits and shows server history", async () => {
    let app = structuredClone(application);
    const fetcher = renderRoute("/app/twin", "ENTREPRENEUR", (url, init) => {
      if (url === "/api/v1/simulations") return respond(simulation);
      if (url === "/api/v1/applications" && init?.method === "POST")
        return respond(app, 201);
      if (url === "/api/v1/applications/1/submit") {
        app = {
          ...app,
          status: "UNDER_REVIEW",
          scoring: { ...simulation, evaluatedAt: "2026-10-23T10:01:00Z" },
          history: [
            ...app.history,
            {
              fromStatus: "DRAFT",
              toStatus: "UNDER_REVIEW",
              actorRole: "SYSTEM",
              comment: "Проверки завершены",
              changedAt: "2026-10-23T10:01:00Z",
            },
          ],
        };
        return respond(app);
      }
      return respond(app);
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Рассчитать сценарии" }),
    );
    expect(
      await screen.findByRole("img", { name: /Три сценария/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Выручка −15%")).toHaveLength(2);
    expect(screen.getAllByText("Выручка −30%")).toHaveLength(2);
    expect(
      screen.queryByText("Условия, предложенные сотрудником банка"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Подать заявку с выбранными параметрами",
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Отправить на рассмотрение" }),
    );
    expect(await screen.findByText("Проверки завершены")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Принять условия" }),
    ).not.toBeInTheDocument();
    const request = fetcher.mock.calls.find(
      ([url]) => url === "/api/v1/simulations",
    );
    expect(JSON.parse(String(request?.[1]?.body))).not.toHaveProperty(
      "purpose",
    );
    const draft = fetcher.mock.calls.find(
      ([url, init]) =>
        url === "/api/v1/applications" && init?.method === "POST",
    );
    expect(JSON.parse(String(draft?.[1]?.body))).toHaveProperty(
      "purpose",
      "EQUIPMENT",
    );
  });
  it("invalidates displayed simulation immediately when parameters change", async () => {
    renderRoute("/app/twin", "ENTREPRENEUR", () => respond(simulation));
    await userEvent.click(
      await screen.findByRole("button", { name: "Рассчитать сценарии" }),
    );
    await screen.findByRole("img", { name: /Три сценария/ });
    fireEvent.change(screen.getByLabelText("Сумма финансирования"), {
      target: { value: "5000000" },
    });
    expect(
      screen.queryByRole("img", { name: /Три сценария/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Подать заявку с выбранными параметрами",
      }),
    ).toBeDisabled();
  });
  it("never fabricates a score or offer when simulation returns 503", async () => {
    renderRoute("/app/twin", "ENTREPRENEUR", () =>
      respond(
        { code: "ENGINE_UNAVAILABLE", message: "Engine offline", details: {} },
        503,
      ),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Рассчитать сценарии" }),
    );
    expect(
      await screen.findByText(
        "Расчёт временно недоступен. Результат не получен.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /Три сценария/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Подать заявку с выбранными параметрами",
      }),
    ).toBeDisabled();
  });
  it("accepts server offer and refreshes authoritative status", async () => {
    let app: ApplicationView = {
      ...application,
      status: "OFFERED",
      offer: {
        amountRub: 2800000,
        termMonths: 36,
        annualRatePct: 20,
        comment: "Проверено",
      },
    };
    const fetcher = renderRoute(
      "/app/applications/1",
      "ENTREPRENEUR",
      (url) => {
        if (url.endsWith("/accept-offer")) app = { ...app, status: "ACCEPTED" };
        return respond(app);
      },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Принять условия" }),
    );
    expect(await screen.findByText("Условия приняты")).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/accept-offer") && init?.method === "POST",
      ),
    ).toBe(true);
  });
  it("on 409 refreshes server state and removes invalid submit action", async () => {
    let app = application;
    renderRoute("/app/applications/1", "ENTREPRENEUR", (url) => {
      if (url.endsWith("/submit")) {
        app = { ...application, status: "UNDER_REVIEW" };
        return respond(
          { code: "STATE_CONFLICT", message: "Already submitted", details: {} },
          409,
        );
      }
      return respond(app);
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Отправить на рассмотрение" }),
    );
    expect(
      await screen.findByText("Состояние заявки изменилось. Обновите данные."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Отправить на рассмотрение" }),
      ).not.toBeInTheDocument(),
    );
  });
  it.each([
    ["NEEDS_INFO", "Отправить повторно", "/resubmit"],
    ["CHECKING", "Повторить проверку", "/submit"],
  ] as const)("supports owner %s recovery", async (status, label, endpoint) => {
    let app: ApplicationView = {
      ...application,
      status,
      statusComment: "Уточните данные",
    };
    const fetcher = renderRoute(
      "/app/applications/1",
      "ENTREPRENEUR",
      (url) => {
        if (url.endsWith(endpoint)) app = { ...app, status: "UNDER_REVIEW" };
        return respond(app);
      },
    );
    await userEvent.click(await screen.findByRole("button", { name: label }));
    expect(await screen.findByText("На рассмотрении")).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith(endpoint) && init?.method === "POST",
      ),
    ).toBe(true);
  });
  it("bank officer simulates disbursement only after acceptance", async () => {
    let app: ApplicationView = { ...application, status: "ACCEPTED" };
    const fetcher = renderRoute(
      "/bank/applications/1",
      "BANK_OFFICER",
      (url) => {
        if (url.endsWith("/simulate-disbursement"))
          app = { ...app, status: "SIMULATED_ISSUED" };
        return respond(app);
      },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Имитировать выдачу" }),
    );
    expect(
      await screen.findByText(
        "Деньги не переводились. Это завершение демонстрационного процесса.",
      ),
    ).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          url === "/api/v1/bank/applications/1/simulate-disbursement" &&
          init?.method === "POST",
      ),
    ).toBe(true);
  });
});
describe("Officer decisions", () => {
  it.each([
    ["APPROVE", "Одобрить и предложить условия"],
    ["DECLINE", "Отказать"],
    ["REQUEST_INFO", "Запросить сведения"],
  ] as const)(
    "submits %s with required comment and exact payload",
    async (decision, label) => {
      const fetcher = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(respond({ ...application, status: "OFFERED" }));
      const done = vi.fn();
      render(
        wrapper(
          <DecisionPanel
            application={{ ...application, status: "UNDER_REVIEW" }}
            product={product}
            onDone={done}
          />,
        ),
      );
      if (decision !== "APPROVE") {
        fireEvent.mouseDown(screen.getByLabelText("Решение"));
        await userEvent.click(await screen.findByText(label));
      }
      await userEvent.click(
        screen.getByRole("button", { name: "Сохранить решение" }),
      );
      expect(await screen.findByText("Объясните решение")).toBeInTheDocument();
      expect(fetcher).not.toHaveBeenCalled();
      await userEvent.type(
        screen.getByLabelText("Комментарий к решению"),
        "Проверено сотрудником",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Сохранить решение" }),
      );
      await waitFor(() => expect(fetcher).toHaveBeenCalled());
      const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
      expect(body).toEqual(
        decision === "APPROVE"
          ? {
              decision,
              comment: "Проверено сотрудником",
              offeredAmountRub: 3000000,
              offeredTermMonths: 36,
            }
          : { decision, comment: "Проверено сотрудником" },
      );
      expect(body).not.toHaveProperty("offeredAnnualRatePct");
      await waitFor(() => expect(done).toHaveBeenCalled());
    },
  );
  it("algorithm recommendation is explicitly not a bank offer", () => {
    render(<ScoreSummary score={simulation} />);
    expect(screen.getByText(/Рекомендация алгоритма:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Решение принимает сотрудник банка/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Принять условия" }),
    ).not.toBeInTheDocument();
  });
  it("renders field-level server error details", () => {
    render(
      <ErrorNotice
        error={
          new ApiError(400, "VALIDATION_ERROR", "Invalid amount", {
            requestedAmountRub: "Сумма вне лимита",
          })
        }
      />,
    );
    expect(
      screen.getByText("requestedAmountRub: Сумма вне лимита"),
    ).toBeInTheDocument();
  });
});
