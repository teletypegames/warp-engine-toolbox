export class FilePath {
  public static join(folder: string, ...parts: string[]): string {
    const separator: string = FilePath.separatorOf(folder)
    const tail: string[] = parts.flatMap((part: string) => part.split(/[\\/]+/)).filter(Boolean)
    return [folder.replace(/[\\/]+$/, ''), ...tail].join(separator)
  }

  public static basename(path: string): string {
    return path.split(/[\\/]/).pop() ?? path
  }

  public static dirname(path: string): string {
    const index: number = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return index <= 0 ? path.slice(0, index + 1) : path.slice(0, index)
  }

  public static relative(folder: string, path: string): string {
    const base: string = folder.replace(/[\\/]+$/, '')
    return path.startsWith(base) ? path.slice(base.length).replace(/^[\\/]+/, '').split('\\').join('/') : path
  }

  private static separatorOf(folder: string): string {
    return folder.includes('\\') && !folder.includes('/') ? '\\' : '/'
  }
}
