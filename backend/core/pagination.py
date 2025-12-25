"""
Custom pagination classes.
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination with configurable page size.
    """
    page_size = 20
    page_size_query_param = 'per_page'
    max_page_size = 100
    
    def get_paginated_response(self, data):
        return Response({
            'data': data,
            'pagination': {
                'page': self.page.number,
                'per_page': self.get_page_size(self.request),
                'total': self.page.paginator.count,
                'total_pages': self.page.paginator.num_pages,
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
            }
        })


class LargeResultsSetPagination(PageNumberPagination):
    """
    Pagination for larger result sets.
    """
    page_size = 50
    page_size_query_param = 'per_page'
    max_page_size = 500


class SmallResultsSetPagination(PageNumberPagination):
    """
    Pagination for smaller result sets (like dropdowns).
    """
    page_size = 10
    page_size_query_param = 'per_page'
    max_page_size = 50
