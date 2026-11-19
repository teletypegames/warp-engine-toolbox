/**
 * A project's Makefile: its targets and its project name.
 *
 * @module
 */
const TARGET = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)/
const PROJECT = /^PROJECT\s*([:?]?=).*$/m

/** A project's Makefile, read for its targets and rewritten for its project name. */
export class Makefile {
  /** The Makefile's file name in the project folder. */
  public static readonly FILE: string = 'Makefile'

  /**
   * Wraps a Makefile's text.
   *
   * @param text - The file content.
   */
  public constructor(private readonly text: string) {}

  /**
   * The plain targets the Makefile defines, offered as tasks: special (`.PHONY`),
   * pattern (`%`) and variable (`$`) targets are left out.
   *
   * @returns The target names, each once, in file order.
   */
  public targets(): string[] {
    const targets: Set<string> = new Set<string>()
    for (const line of this.text.split(/\r?\n/)) {
      const name: string | undefined = TARGET.exec(line)?.[1]
      if (name && Makefile.isPlainTarget(name)) targets.add(name)
    }
    return [...targets]
  }

  /**
   * The text with the `PROJECT` variable set to a name, keeping its assignment operator.
   *
   * @param name - The project name.
   * @returns The new text, or the text unchanged when it has no `PROJECT` line.
   */
  public withProject(name: string): string {
    return PROJECT.test(this.text) ? this.text.replace(PROJECT, `PROJECT $1 ${name}`) : this.text
  }

  private static isPlainTarget(name: string): boolean {
    return !name.startsWith('.') && !name.includes('%') && !name.includes('$')
  }
}
