import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card, Pill, MoonGlyph } from "@/components/ui";

describe("Card", () => {
  test("renders its children", () => {
    render(<Card>hello</Card>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

describe("Pill", () => {
  test("calls onClick when pressed", async () => {
    const onClick = jest.fn();
    render(<Pill onClick={onClick}>Happy</Pill>);
    await userEvent.click(screen.getByText("Happy"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("is type=button so it never submits a surrounding form", () => {
    render(<Pill onClick={() => {}}>Calm</Pill>);
    expect(screen.getByText("Calm")).toHaveAttribute("type", "button");
  });

  test("renders with the filled/active style when active=true", () => {
    render(<Pill active onClick={() => {}}>Selected</Pill>);
    expect(screen.getByText("Selected")).toHaveStyle({ color: "#fff" });
  });

  test("renders with the outline/inactive style when active is falsy", () => {
    render(<Pill onClick={() => {}}>Unselected</Pill>);
    expect(screen.getByText("Unselected")).not.toHaveStyle({ color: "#fff" });
  });
});

describe("MoonGlyph", () => {
  test("renders an svg containing a phase path", () => {
    const { container } = render(<MoonGlyph frac={0.5} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path.getAttribute("d")).toMatch(/^M /);
  });

  test("produces a different path for different phase fractions", () => {
    const { container: c1 } = render(<MoonGlyph frac={0.1} />);
    const { container: c2 } = render(<MoonGlyph frac={0.9} />);
    const d1 = c1.querySelector("path").getAttribute("d");
    const d2 = c2.querySelector("path").getAttribute("d");
    expect(d1).not.toBe(d2);
  });

  // moonSvgPath has two internal ternaries (waxing vs waning, and whether
  // frac sits in the "crescent/gibbous extremes" band or not) — these four
  // fractions hit all four combinations of those two branches.
  test.each([
    [0.1, "waxing, outside the 0.25–0.75 band"],
    [0.4, "waxing, inside the 0.25–0.75 band"],
    [0.6, "waning, inside the 0.25–0.75 band"],
    [0.9, "waning, outside the 0.25–0.75 band"],
  ])("renders a valid path at frac=%f (%s)", (frac) => {
    const { container } = render(<MoonGlyph frac={frac} />);
    const path = container.querySelector("path");
    expect(path.getAttribute("d")).toMatch(/^M /);
  });
});
