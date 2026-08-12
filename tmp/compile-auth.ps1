Set-Location 'c:\Users\lmwangi\Desktop\InvoiceLens\apps\web'
Remove-Item -Recurse -Force .tmp-auth-build -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path .tmp-auth-build -Force | Out-Null
& 'c:\Users\lmwangi\Desktop\InvoiceLens\tmp\node\node-v20.19.5-win-x64\node.exe' '..\..\node_modules\typescript\bin\tsc' 'src/shared/auth.ts' '--target' 'es2020' '--module' 'es2020' '--lib' 'dom,es2020' '--pretty' 'false' '--outDir' '.tmp-auth-build'
Get-ChildItem .tmp-auth-build -Recurse -File | Select-Object FullName
