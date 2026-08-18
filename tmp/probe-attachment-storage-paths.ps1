$ErrorActionPreference = 'Stop'
Set-Location 'c:\Users\lmwangi\Desktop\InvoiceLens'

$e = @{}
Get-Content '.env' | ForEach-Object {
  $l = $_.Trim()
  if (-not $l -or $l.StartsWith('#')) { return }
  $i = $l.IndexOf('=')
  if ($i -lt 1) { return }
  $e[$l.Substring(0, $i)] = $l.Substring($i + 1)
}

& 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE' `
  -S $e['InvoiceLens__Sql__ServerHost'] `
  -U $e['InvoiceLens__Sql__Username'] `
  -P $e['InvoiceLens__Sql__Password'] `
  -d $e['InvoiceLens__Sql__DatabaseName'] `
  -N -C -W -s '|' -b `
  -Q "SELECT TOP 40 i.InvoiceNumber, ia.OpenInvoiceAttachmentId, ia.FileName, ia.ContentType, ia.StoragePath FROM dbo.InvoiceAttachments ia INNER JOIN dbo.Invoice i ON i.InvoiceId=ia.InvoiceId ORDER BY ia.CreatedAtUtc DESC;"
