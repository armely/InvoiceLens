#!/usr/bin/env pwsh
<#
.SYNOPSIS
Test InvoiceLens OpenInvoice API with HMAC Authentication

.DESCRIPTION
Tests all OpenInvoice API endpoints (mock or real) with proper HMAC SHA256 signing.
Supports both local and remote testing.

.EXAMPLE
.\Test-OpenInvoiceApi.ps1 -BaseUrl "http://localhost:5189" -HmacKey "local-test-hmac-key"
.\Test-OpenInvoiceApi.ps1 -BaseUrl "https://vm-address:5189" -HmacKey "local-test-hmac-key" -VerboseOutput
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$BaseUrl = "http://localhost:5189",
    
    [Parameter(Mandatory = $false)]
    [string]$HmacKey = "local-test-hmac-key",
    
    [Parameter(Mandatory = $false)]
    [string]$MacHeaderName = "mac",
    
    [Parameter(Mandatory = $false)]
    [switch]$VerboseOutput,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipCertificateValidation
)

# Colors for output
$colors = @{
    Success = 'Green'
    Error   = 'Red'
    Warning = 'Yellow'
    Info    = 'Cyan'
    Header  = 'Magenta'
}

# ============================================================================
# HMAC Calculation Function
# ============================================================================
function Get-HmacSignature {
    param(
        [string]$Method,
        [string]$Body,
        [string]$Key
    )
    
    $inputString = if ($Method -eq "GET") { "" } else { $Body }
    $hmacsha256 = New-Object System.Security.Cryptography.HMACSHA256
    $hmacsha256.key = [Text.Encoding]::UTF8.GetBytes($Key)
    $signature = [Convert]::ToBase64String($hmacsha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($inputString)))
    return $signature
}

# ============================================================================
# Test Helper Functions
# ============================================================================
function Invoke-ApiRequest {
    param(
        [string]$Uri,
        [string]$Method = "Get",
        [hashtable]$Body,
        [string]$Description
    )
    
    try {
        # Prepare body
        $bodyJson = $null
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json -Depth 10
        }
        
        # Calculate HMAC
        $signature = Get-HmacSignature -Method $Method -Body $bodyJson -Key $HmacKey
        
        # Prepare headers
        $headers = @{
            $MacHeaderName = $signature
            "Accept"       = "application/json"
        }
        
        if ($VerboseOutput) {
            Write-Host "  Request: $Method $Uri" -ForegroundColor $colors.Info
            Write-Host "  HMAC Signature: $($signature.Substring(0, 20))..." -ForegroundColor $colors.Info
        }
        
        # Make request
        $params = @{
            Uri            = $Uri
            Method         = $Method
            Headers        = $headers
            ContentType    = "application/json"
            TimeoutSec     = 10
        }
        
        if ($SkipCertificateValidation) {
            $params.SkipCertificateCheck = $true
        }
        
        if ($bodyJson) {
            $params.Body = $bodyJson
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host "  ✓ $Description" -ForegroundColor $colors.Success
        if ($VerboseOutput) {
            Write-Host "    Response: $($response | ConvertTo-Json -Depth 2 | Select-Object -First 5)" -ForegroundColor $colors.Info
        }
        
        return $response
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        $errorMsg = $_.Exception.Message
        Write-Host "  ✗ $Description - Error: $errorMsg" -ForegroundColor $colors.Error
        if ($VerboseOutput) {
            Write-Host "    Status Code: $statusCode" -ForegroundColor $colors.Error
        }
        return $null
    }
}

# ============================================================================
# Main Test Flow
# ============================================================================
Write-Host "`n" + ("="*80) -ForegroundColor $colors.Header
Write-Host "InvoiceLens OpenInvoice API Test Suite" -ForegroundColor $colors.Header
Write-Host "="*80 -ForegroundColor $colors.Header

Write-Host "`nConfiguration:" -ForegroundColor $colors.Header
Write-Host "  Base URL: $BaseUrl"
Write-Host "  HMAC Key: $HmacKey"
Write-Host "  MAC Header: $MacHeaderName"
Write-Host "  Verbose: $VerboseOutput"
Write-Host ""

# Test connectivity
Write-Host "Checking connectivity..." -ForegroundColor $colors.Info
try {
    $uri = "$BaseUrl/docp/supply-chain/v1/invoices"
    $response = Invoke-RestMethod -Uri $uri -TimeoutSec 5 -SkipCertificateCheck:$SkipCertificateValidation
    Write-Host "  ✓ API is reachable`n" -ForegroundColor $colors.Success
}
catch {
    Write-Host "  ✗ Cannot reach API at $BaseUrl" -ForegroundColor $colors.Error
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor $colors.Error
    exit 1
}

# ============================================================================
# Test 1: Get Invoices (List)
# ============================================================================
Write-Host "Test 1: Get Invoices (List)" -ForegroundColor $colors.Header
$invoices = Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/supply-chain/v1/invoices?`$skip=0&`$top=10" `
    -Method "Get" `
    -Description "Get invoices list with pagination"

# ============================================================================
# Test 2: Get Invoices with Filter
# ============================================================================
Write-Host "`nTest 2: Get Invoices with Filter" -ForegroundColor $colors.Header
Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/supply-chain/v1/invoices?`$filter=serviceType eq approved" `
    -Method "Get" `
    -Description "Get approved invoices"

# ============================================================================
# Test 3: Get Specific Invoice
# ============================================================================
Write-Host "`nTest 3: Get Specific Invoice" -ForegroundColor $colors.Header

# Use first invoice ID if available
$invoiceId = $invoices.links[0].href.Split('/')[-1] 2>/dev/null
if (-not $invoiceId) {
    $invoiceId = "INV-001"
}

Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/supply-chain/v1/invoices/$invoiceId" `
    -Method "Get" `
    -Description "Get invoice details for ID: $invoiceId"

# ============================================================================
# Test 4: Get Invoice Attachments
# ============================================================================
Write-Host "`nTest 4: Get Invoice Attachments" -ForegroundColor $colors.Header
Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/supply-chain/v1/invoices/$invoiceId/attachments" `
    -Method "Get" `
    -Description "Get attachments for invoice: $invoiceId"

# ============================================================================
# Test 5: POST - Export Status
# ============================================================================
Write-Host "`nTest 5: POST - Export Status Event" -ForegroundColor $colors.Header
$exportBody = @{
    context = @{ 
        documentId = $invoiceId 
    }
    transform = @{ 
        serviceStatus = "success" 
    }
}
Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/events/supply-chain/v1/invoice.exports.set" `
    -Method "Post" `
    -Body $exportBody `
    -Description "Post export status event"

# ============================================================================
# Test 6: POST - Approve Invoice
# ============================================================================
Write-Host "`nTest 6: POST - Approve Invoice" -ForegroundColor $colors.Header
$approveBody = @{
    context = @{ 
        documentId = $invoiceId 
    }
    transform = @{ 
        status  = "approved"
        comment = "Approved by test script"
    }
}
Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/events/supply-chain/v1/invoice.approve" `
    -Method "Post" `
    -Body $approveBody `
    -Description "Post invoice approval"

# ============================================================================
# Test 7: POST - Add Comment
# ============================================================================
Write-Host "`nTest 7: POST - Add Comment" -ForegroundColor $colors.Header
$commentBody = @{
    context = @{ 
        documentId = $invoiceId 
    }
    transform = @{ 
        comment = "Test comment from automation"
    }
}
Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/events/supply-chain/v1/invoice.comment.add" `
    -Method "Post" `
    -Body $commentBody `
    -Description "Post invoice comment"

# ============================================================================
# Test 8: POST - Dispute Invoice
# ============================================================================
Write-Host "`nTest 8: POST - Dispute Invoice" -ForegroundColor $colors.Header
$disputeBody = @{
    context = @{ 
        documentId = $invoiceId 
    }
    transform = @{ 
        status  = "disputed"
        comment = "Test dispute from automation"
    }
}
Invoke-ApiRequest `
    -Uri "$BaseUrl/docp/events/supply-chain/v1/invoice.dispute" `
    -Method "Post" `
    -Body $disputeBody `
    -Description "Post invoice dispute"

# ============================================================================
# Summary
# ============================================================================
Write-Host "`n" + ("="*80) -ForegroundColor $colors.Header
Write-Host "Test Suite Complete" -ForegroundColor $colors.Header
Write-Host "="*80 -ForegroundColor $colors.Header
Write-Host ""
