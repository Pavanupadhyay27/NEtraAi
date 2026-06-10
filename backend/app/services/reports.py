import io
from typing import List, Dict, Any
import pandas as pd
from datetime import datetime, date

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class ReportGenerator:
    @staticmethod
    def to_csv(data: List[Dict[str, Any]]) -> str:
        """
        Converts list of dicts to CSV string.
        """
        if not data:
            return ""
        df = pd.DataFrame(data)
        return df.to_csv(index=False)

    @staticmethod
    def to_xlsx(data: List[Dict[str, Any]], sheet_name: str = "Report") -> bytes:
        """
        Converts list of dicts to Excel binary stream.
        """
        output = io.BytesIO()
        if not data:
            # Create an empty excel file
            df = pd.DataFrame([{"Message": "No data available"}])
        else:
            df = pd.DataFrame(data)
            
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name)
            
            # Format sheet with openpyxl
            workbook = writer.book
            worksheet = writer.sheets[sheet_name]
            
            # Auto-fit columns
            for col in worksheet.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 3, 10)
                
        output.seek(0)
        return output.getvalue()

    @staticmethod
    def to_pdf(title: str, headers: List[str], rows: List[List[Any]], metadata: Dict[str, str] = None) -> bytes:
        """
        Generates a premium, clean PDF report using ReportLab.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            name='ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0F172A'), # Slate 900
            spaceAfter=15
        )
        
        meta_label_style = ParagraphStyle(
            name='MetaLabel',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#475569') # Slate 600
        )
        
        meta_val_style = ParagraphStyle(
            name='MetaVal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#0F172A')
        )
        
        table_header_style = ParagraphStyle(
            name='TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.white
        )
        
        table_cell_style = ParagraphStyle(
            name='TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#334155') # Slate 700
        )

        elements = []
        
        # Add Title
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 10))
        
        # Add Metadata Block
        if metadata:
            meta_data = []
            keys = list(metadata.keys())
            for i in range(0, len(keys), 2):
                row = []
                # First col
                k1 = keys[i]
                row.extend([Paragraph(k1, meta_label_style), Paragraph(metadata[k1], meta_val_style)])
                # Second col
                if i + 1 < len(keys):
                    k2 = keys[i+1]
                    row.extend([Paragraph(k2, meta_label_style), Paragraph(metadata[k2], meta_val_style)])
                else:
                    row.extend([Paragraph("", meta_label_style), Paragraph("", meta_val_style)])
                meta_data.append(row)
                
            meta_table = Table(meta_data, colWidths=[100, 170, 100, 170])
            meta_table.setStyle(TableStyle([
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
            ]))
            elements.append(meta_table)
            elements.append(Spacer(1, 20))
            
        # Draw a line
        line_table = Table([[""]], colWidths=[540], rowHeights=[1])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ]))
        elements.append(line_table)
        elements.append(Spacer(1, 15))
        
        # Prepare Data Table
        table_data = []
        # Header row
        table_data.append([Paragraph(h, table_header_style) for h in headers])
        
        # Data rows
        for r in rows:
            table_data.append([Paragraph(str(cell), table_cell_style) for cell in r])
            
        # Calculate widths dynamically
        col_width = 540 / len(headers)
        data_table = Table(table_data, colWidths=[col_width] * len(headers))
        
        # Table Styling
        grid_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')), # Dark Header
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#F1F5F9')),
        ])
        
        # Alternating row colors
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                grid_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor('#F8FAFC'))
                
        data_table.setStyle(grid_style)
        elements.append(data_table)
        
        # Build Document
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
