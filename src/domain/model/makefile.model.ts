const TARGET = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)/
const PROJECT = /^PROJECT\s*([:?]?=).*$/m

export class Makefile {
  public static readonly FILE: string = 'Makefile'

  public constructor(private readonly text: string) {}

  public targets(): string[] {
    const targets: Set<string> = new Set<string>()
    for (const line of this.text.split(/\r?\n/)) {
      const name: string | undefined = TARGET.exec(line)?.[1]
      if (name && Makefile.isPlainTarget(name)) targets.add(name)
    }
    return [...targets]
  }

  public withProject(name: string): string {
    return PROJECT.test(this.text) ? this.text.replace(PROJECT, `PROJECT $1 ${name}`) : this.text
  }

  private static isPlainTarget(name: string): boolean {
    return !name.startsWith('.') && !name.includes('%') && !name.includes('$')
  }
}
