// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import {
  CustomModelDialog,
  ModelPicker,
  type ModelChoice,
} from "./ModelPicker";
import { ModelFamilyMenu } from "./ModelFamilyMenu";
import { CreateModelChoices } from "./CreateModelChoices";
import { ModelDiscoveryRecovery } from "./ModelDiscoveryRecovery";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

it.each(["submit", "cancel"] as const)(
  "keeps the custom model's same raw draft, selection and form while translating before %s",
  (action) => {
    const submit = vi.fn(),
      close = vi.fn();
    render(
      <CustomModelDialog
        initialValue="Custom model {id} 한글"
        onSubmit={submit}
        onClose={() => close()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Custom model" });
    const input = screen.getByRole("textbox", { name: "Model ID" });
    if (!(input instanceof HTMLInputElement))
      throw new Error("Missing model ID input");
    const form = input.closest("form");
    if (!form) throw new Error("Missing custom model form");
    const formId = form.id;
    input.focus();
    input.setSelectionRange(2, 8);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("dialog", {
          name: language === "ko" ? "직접 지정 모델" : "Custom model",
        }),
      ).toBe(dialog);
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? "모델 ID" : "Model ID",
        }),
      ).toBe(input);
      expect(input).toHaveValue("Custom model {id} 한글");
      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(8);
      expect(input).toHaveAttribute(
        "placeholder",
        language === "ko" ? "모델 ID를 입력하세요" : "Enter a model ID",
      );
      expect(input.closest("form")).toBe(form);
      expect(form.id).toBe(formId);
      expect(submit).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    }
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Use model" })).toBeDisabled();
    fireEvent.change(input, {
      target: { value: "  provider/model:{id} 한글  " },
    });
    if (action === "submit") {
      fireEvent.submit(form);
      expect(submit).toHaveBeenCalledExactlyOnceWith(
        "provider/model:{id} 한글",
      );
      expect(close).not.toHaveBeenCalled();
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(close).toHaveBeenCalledExactlyOnceWith();
      expect(submit).not.toHaveBeenCalled();
    }
  },
);

it("keeps raw discovery failure and retry focus through locale and held recovery without another retry", async () => {
  let finish: () => void = () => {
    throw new Error("Missing recovery gate");
  };
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const retry = vi.fn();
  function Recovery() {
    const [loading, setLoading] = useState(false),
      [error, setError] = useState<string | undefined>("Try again");
    return (
      <ModelDiscoveryRecovery
        loading={loading}
        error={error}
        retry={() => {
          retry();
          setError(undefined);
          setLoading(true);
          void held.then(() => setLoading(false));
        }}
      >
        <button type="button">Raw model control</button>
      </ModelDiscoveryRecovery>
    );
  }
  render(<Recovery />);
  const button = screen.getByRole("button", { name: "Try again" }),
    alert = screen.getByRole("alert");
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name: language === "ko" ? "다시 시도" : "Try again",
      }),
    ).toBe(button);
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert.textContent).toBe("Try again");
    expect(retry).not.toHaveBeenCalled();
  }
  const user = userEvent.setup();
  try {
    await user.click(button);
    expect(button).toHaveFocus();
    expect(retry).toHaveBeenCalledExactlyOnceWith();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "다시 시도" : "Try again",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(retry).toHaveBeenCalledOnce();
    }
  } finally {
    await act(async () => finish());
  }
  expect(
    screen.getByRole("button", { name: "Raw model control" }),
  ).toHaveFocus();
  expect(retry).toHaveBeenCalledOnce();
});

it("keeps an open Select and raw catalog names while local default/custom captions and keyboard selection translate", async () => {
  const changed = vi.fn(),
    user = userEvent.setup();
  const models: readonly ModelChoice[] = [
    {
      id: "raw-default",
      label: "Custom model",
      description: "Enter a model ID",
    },
    { id: "raw-other", label: "Default", description: "Unavailable model" },
  ];
  render(
    <ModelPicker
      models={models}
      defaultModel="raw-default"
      defaultLabel="Provider default"
      value=""
      allowCustomModel
      onChange={changed}
    />,
  );
  const trigger = screen.getByRole("combobox", { name: "Model" });
  await user.click(trigger);
  const popup = await screen.findByRole("listbox"),
    option = await screen.findByRole("option", { name: "Default" });
  screen.getByRole("option", { name: "Custom model · Default" }).focus();
  await user.keyboard("{ArrowDown}");
  await waitFor(() => expect(option).toHaveFocus());
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("combobox", {
        name: language === "ko" ? "모델" : "Model",
      }),
    ).toBe(trigger);
    expect(screen.getByRole("listbox")).toBe(popup);
    expect(option).toHaveFocus();
    expect(option).toHaveAccessibleName("Default");
    expect(option).toHaveAccessibleDescription("Unavailable model");
    expect(
      screen.getByRole("option", {
        name:
          language === "ko"
            ? "Custom model · 기본값"
            : "Custom model · Default",
      }),
    ).toHaveAccessibleDescription("Enter a model ID");
    expect(
      screen.getByRole("option", {
        name: language === "ko" ? "직접 지정 모델" : "Custom model",
      }),
    ).toHaveAccessibleDescription(
      language === "ko" ? "모델 ID를 입력하세요" : "Enter a model ID",
    );
    expect(changed).not.toHaveBeenCalled();
  }
  await user.keyboard("{Enter}");
  expect(changed).toHaveBeenCalledExactlyOnceWith("raw-other");
});

it("translates only the owned family loading caption and keeps its trigger and canonical loading artwork", () => {
  const changed = vi.fn(),
    load = vi.fn();
  const models = [{ id: "opaque", label: "Claude raw", loadEfforts: load }];
  render(
    <ModelPicker
      groupByFamily
      models={models}
      value="opaque"
      defaultLabel="Raw default"
      loading
      onChange={changed}
    />,
  );
  const trigger = screen.getByRole("button", {
      name: "Model: Loading models…",
    }),
    artwork = trigger.querySelector("svg");
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name:
          language === "ko"
            ? "모델: 모델 불러오는 중…"
            : "Model: Loading models…",
      }),
    ).toBe(trigger);
    expect(trigger.querySelector("svg")).toBe(artwork);
    expect(changed).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  }
});

it.each([undefined, "Loading models…", ""])(
  "keeps direct selectionLabel=%s raw and separate from canonical model artwork",
  (selectionLabel) => {
    const selected = { id: "opaque", label: "Claude raw" },
      changed = vi.fn();
    render(
      <ModelFamilyMenu
        label="Raw field"
        selected={selected}
        models={[selected]}
        selectionLabel={selectionLabel}
        disabled={false}
        onChange={changed}
      />,
    );
    const trigger = screen.getByRole("button", {
        name: `Raw field: ${selectionLabel ?? selected.label}`.trim(),
      }),
      artwork = trigger.querySelector("svg");
    expect(artwork).not.toBeNull();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: `Raw field: ${selectionLabel ?? selected.label}`.trim(),
        }),
      ).toBe(trigger);
      expect(trigger.querySelector(".buzz-select-value")?.textContent).toBe(
        selectionLabel ?? selected.label,
      );
      expect(trigger.querySelector("svg")).toBe(artwork);
      expect(changed).not.toHaveBeenCalled();
    }
  },
);

it("keeps explicit Other families raw and translates only a provably local fallback without changing its menu identity", async () => {
  const user = userEvent.setup(),
    changed = vi.fn(),
    unknown = { id: "raw-unknown", label: "Custom model" };
  const props = {
    label: "Raw field",
    selected: unknown,
    disabled: false,
    onChange: changed,
  };
  const view = render(
    <ModelFamilyMenu
      {...props}
      models={[unknown, { id: "explicit", label: "Default", family: "Other" }]}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Raw field: Custom model" }),
  );
  const other = await screen.findByRole("menuitem", { name: "Other" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("menuitem", { name: "Other" })).toBe(other);
  expect(screen.queryByRole("menuitem", { name: "기타" })).toBeNull();
  view.rerender(<ModelFamilyMenu {...props} models={[unknown]} />);
  expect(screen.getByRole("menuitem", { name: "기타" })).toBe(other);
  other.focus();
  await user.keyboard("{ArrowRight}");
  const popup = await screen.findByRole("menu", { name: "기타 모델" }),
    option = screen.getByRole("menuitemradio", { name: "Custom model" });
  act(() => setLanguage("en"));
  expect(screen.getByRole("menu", { name: "Other models" })).toBe(popup);
  expect(option).toHaveAccessibleName("Custom model");
  expect(changed).not.toHaveBeenCalled();
  await user.click(option);
  expect(changed).toHaveBeenCalledExactlyOnceWith("raw-unknown");
});

it.each(["success", "failure"] as const)(
  "keeps the actual effort popup and one held discovery through locale and %s",
  async (outcome) => {
    let resolve: (levels: readonly { id: string; label: string }[]) => void = (
      _levels,
    ) => {
      throw new Error("Missing effort gate");
    };
    let reject: (reason: Error) => void = (_reason) => {
      throw new Error("Missing effort gate");
    };
    const held = new Promise<readonly { id: string; label: string }[]>(
      (yes, no) => {
        resolve = yes;
        reject = no;
      },
    );
    const load = vi.fn(() => held),
      choose = vi.fn(),
      model = vi.fn(),
      user = userEvent.setup();
    const raw = "Provider thinking effort";
    render(
      <ModelPicker
        groupByFamily
        includeDefault={false}
        models={[
          {
            id: "gpt-raw",
            label: raw,
            loadEfforts: load,
            effortScope: "raw-scope",
          },
        ]}
        value="gpt-raw"
        defaultLabel="Raw default"
        onChange={model}
        onEffortChange={choose}
      />,
    );
    await user.click(screen.getByRole("button", { name: `Model: ${raw}` }));
    const family = await screen.findByRole("menuitem", { name: "OpenAI" });
    family.focus();
    await user.keyboard("{ArrowRight}");
    const entry = await screen.findByRole("menuitemradio", { name: raw });
    entry.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    const popup = await screen.findByRole("menu", {
        name: `${raw} thinking effort`,
      }),
      focus = document.activeElement;
    try {
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("menu", {
            name: `${raw} ${language === "ko" ? "사고 수준" : "thinking effort"}`,
          }),
        ).toBe(popup);
        expect(
          screen.getByText(
            language === "ko"
              ? "사고 수준 불러오는 중…"
              : "Loading thinking levels…",
          ),
        ).toBeVisible();
        expect(document.activeElement).toBe(focus);
        expect(load).toHaveBeenCalledOnce();
        expect(choose).not.toHaveBeenCalled();
        expect(model).not.toHaveBeenCalled();
      }
    } finally {
      await act(async () =>
        outcome === "success"
          ? resolve([
              { id: "", label: "Default" },
              { id: "raw-high", label: "High {id} 한글" },
            ])
          : reject(new Error("Could not load thinking levels")),
      );
    }
    if (outcome === "success") {
      const high = await screen.findByRole("menuitemradio", {
        name: "High {id} 한글",
      });
      act(() => setLanguage("ko"));
      expect(high).toHaveAccessibleName("High {id} 한글");
      await user.click(high);
      expect(choose).toHaveBeenCalledExactlyOnceWith("gpt-raw", "raw-high");
    } else {
      const failure = screen.getByText("Could not load thinking levels");
      act(() => setLanguage("ko"));
      expect(screen.getByText("사고 수준을 불러올 수 없습니다")).toBe(failure);
      await user.click(screen.getByRole("menuitem", { name: "모델 사용" }));
      expect(choose).toHaveBeenCalledExactlyOnceWith("gpt-raw", "");
    }
    expect(load).toHaveBeenCalledOnce();
    expect(model).not.toHaveBeenCalled();
  },
);

it("uses whole Fast/Default/effort names without translating the model, field or provider effort", () => {
  const selected = { id: "raw-id", label: "Custom model {name}", fast: true },
    changed = vi.fn();
  render(
    <ModelFamilyMenu
      label="Model"
      selected={selected}
      models={[selected]}
      inherited
      effortLabel="High"
      disabled={false}
      onChange={changed}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: "Model: Custom model {name} · Fast · Default, High",
  });
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name:
          language === "ko"
            ? "Model: Custom model {name} · 빠름 · 기본값, High"
            : "Model: Custom model {name} · Fast · Default, High",
      }),
    ).toBe(trigger);
    expect(
      within(trigger).getByTitle(language === "ko" ? "빠름" : "Fast"),
    ).toBeVisible();
    expect(trigger).toHaveTextContent("High");
    expect(changed).not.toHaveBeenCalled();
  }
});

it("keeps CreateModelChoices raw error and controlled model through a held retry and locale", async () => {
  let finish: () => void = () => {
    throw new Error("Missing choices gate");
  };
  const held = new Promise<void>((yes) => {
      finish = yes;
    }),
    retry = vi.fn(),
    changed = vi.fn();
  const models = [
    { id: "raw-first", label: "Custom model" },
    { id: "raw-second", label: "Unavailable model" },
  ];
  function Choices() {
    const [value, setValue] = useState("raw-first"),
      [loading, setLoading] = useState(false);
    return (
      <CreateModelChoices
        models={models}
        value={value}
        defaultLabel="Default"
        includeDefault={false}
        disabled={false}
        loading={loading}
        error="Try again"
        retry={() => {
          retry();
          setLoading(true);
          void held.then(() => setLoading(false));
        }}
        onChange={(next) => {
          changed(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Choices />);
  const user = userEvent.setup(),
    retryButton = screen.getByRole("button", { name: "Try again" }),
    trigger = screen.getByRole("combobox", { name: "Model" }),
    alert = screen.getByRole("alert");
  try {
    await user.click(retryButton);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("combobox", {
          name: language === "ko" ? "모델" : "Model",
        }),
      ).toBe(trigger);
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "다시 시도" : "Try again",
        }),
      ).toBe(retryButton);
      expect(retryButton).toBeDisabled();
      expect(trigger).toBeDisabled();
      expect(alert.textContent).toBe("Try again");
      expect(retry).toHaveBeenCalledOnce();
      expect(changed).not.toHaveBeenCalled();
    }
  } finally {
    await act(async () => finish());
  }
  await user.click(trigger);
  await user.click(
    await screen.findByRole("option", { name: "Unavailable model" }),
  );
  expect(changed).toHaveBeenCalledExactlyOnceWith("raw-second");
  expect(trigger).toHaveTextContent("Unavailable model");
  expect(retry).toHaveBeenCalledOnce();
});

it("keeps explicit empty and same-English field labels raw while only the absent label follows the locale", () => {
  const changed = vi.fn();
  const props = {
    models: [{ id: "raw", label: "Raw model" }],
    value: "raw",
    defaultLabel: "Raw default",
    onChange: changed,
  };
  const view = render(<ModelPicker {...props} />);
  const trigger = screen.getByRole("combobox", { name: "Model" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("combobox", { name: "모델" })).toBe(trigger);
  for (const label of ["", "Model"]) {
    view.rerender(<ModelPicker {...props} label={label} />);
    expect(screen.getByRole("combobox", { name: label })).toBe(trigger);
    act(() => setLanguage("en"));
    expect(screen.getByRole("combobox", { name: label })).toBe(trigger);
    act(() => setLanguage("ko"));
    expect(screen.getByRole("combobox", { name: label })).toBe(trigger);
  }
  expect(changed).not.toHaveBeenCalled();
});

it.each([true, false])(
  "translates the locally constructed missing-model description with allowCustomModel=%s and returns the raw ID",
  async (allowCustomModel) => {
    const changed = vi.fn(),
      user = userEvent.setup(),
      raw = "opaque/{id} 한글";
    render(
      <ModelPicker
        groupByFamily
        models={[]}
        value={raw}
        defaultLabel="Raw default"
        includeDefault={false}
        allowCustomModel={allowCustomModel}
        onChange={changed}
      />,
    );
    const trigger = screen.getByRole("button", { name: `Model: ${raw}` });
    await user.click(trigger);
    const family = await screen.findByRole("menuitem", { name: "Other" });
    family.focus();
    await user.keyboard("{ArrowRight}");
    const option = await screen.findByRole("menuitemradio", {
      name: `${raw} · ${allowCustomModel ? "Custom model" : "Unavailable model"}`,
    });
    option.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      const description =
        language === "ko"
          ? allowCustomModel
            ? "직접 지정 모델"
            : "사용할 수 없는 모델"
          : allowCustomModel
            ? "Custom model"
            : "Unavailable model";
      expect(
        screen.getByRole("menuitemradio", { name: `${raw} · ${description}` }),
      ).toBe(option);
      expect(option).toHaveFocus();
      expect(trigger.querySelector(".buzz-select-value")?.textContent).toBe(
        raw,
      );
      expect(changed).not.toHaveBeenCalled();
    }
    await user.keyboard("{Enter}");
    expect(changed).toHaveBeenCalledExactlyOnceWith(raw);
  },
);
