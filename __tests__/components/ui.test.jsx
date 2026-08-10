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
});
