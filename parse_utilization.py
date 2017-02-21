#!/usr/bin/env python3

import re
import json
import sys
import logging

#-------------------------------------------------------------------------------
class ReportHeading:
    def __init__(self, title, pos):
        self.pos = pos
        self.title = title
        
    @classmethod
    def get_next(cls, f):
        """
        Finds the next heading in a file.
        Returns None if not found
        """
        
        prev_line = ""
        while(True):
            line = f.readline()
            if(line == ""):
                break
            line = line.strip()
            
            m1 = re.match(r'^[\d\.]+\s+.+$', prev_line)
            m2 = re.match(r'^-+$', line)
            if(m1 and m2):
                return(cls(prev_line, f.tell()))
            prev_line = line
        return(None)

#-------------------------------------------------------------------------------
class Row:
    def __init__(self):
        self.name = ""
        self.values = {}
    
    @classmethod
    def from_data(cls, headings, cells):
        """
        Create new row from raw table data
        Assumes idx 0 is the row's name
        """
        R = cls()
        headings.pop(0)
        R.name = cells.pop(0)
        R.values = dict(zip(headings, cells))
        return(R)
        
#-------------------------------------------------------------------------------
class Table:
    def __init__(self):
        self.name = ""
        self.rows = []
        self._row_hier = []
        self.headings = []
    
    @classmethod
    def get_next(cls, f, name=""):
        
        # Seek to start of next table
        for line in f:
            if(re.match(r'^(\+-+)+\+$', line)):
                break
        else:
            return(None)
        
        T = cls()
        T.name = name
        # Get column headings
        line = f.readline()
        T.headings = re.findall(r'\|\s*(.+?)\s*(?=\|)', line)
        
        # skip header separator line
        line = f.readline()
        
        T.rows = []
        T._row_hier = []
        for line in f:
            # stop if reached end of table
            if(re.match(r'^(\+-+)+\+$', line)):
                break
            
            cells = re.findall(r'\|\s*(.+?)\s*(?=\|)', line)
            hier = int(len(re.findall(r'^\|\s(\s*)', line)[0])/2)
            T.rows.append(Row.from_data(T.headings.copy(), cells))
            T._row_hier.append(hier)
        
        return(T)
    
#-------------------------------------------------------------------------------
class Hierarchy(Row):
    def __init__(self):
        Row.__init__(self)
        self.parent = None
        self.children = []
    
    @classmethod
    def from_table(cls, T):
        H = cls()
        H.name = T.name
        H._add_children(T)
        return(H)
    
    def print_hier(self, _indent=0):
        print("%s%s" % ("  "*_indent, self.name))
        for child in self.children:
            child.print_hier(_indent+1)
    
    def to_json(self, filename):
        with open(filename, 'w') as f:
            D = self.to_dict()
            json.dump(D, f, indent=2)
            
    def to_dict(self):
        D = {}
        D["name"] = self.name
        if(len(self.children)):
            D["children"] = []
            for child in self.children:
                D["children"].append(child.to_dict())
        else:
            # is leaf node. Write out values
            pass
        D.update(self.values)
        return(D)
    
    def _add_children(self, T, current_depth=-1):
        while(len(T._row_hier)):
            if(T._row_hier[0] <= current_depth):
                # next row is not a child of this node
                break
            
            # next row is a child of this node
            self.children.append(type(self)._add_next_node(T, self))
    
    @classmethod
    def _add_next_node(cls, T, parent=None):
        """
        Pop first entry in the table and creates a hierarchical row.
        Then, inspects the next entry's hier depth:
            - if equal or less than current depth, return
            - if greater than current depth, recurses and adds result as child
        """
        R = T.rows.pop(0)
        current_depth = T._row_hier.pop(0)
        N = cls()
        N.name = R.name
        N.values = R.values
        N.parent = parent
        N._add_children(T, current_depth)
        return(N)
        
#===============================================================================
import argparse
import logging

class App:
    def __init__(self):
        
        """ Parsed command line options """
        self.options = None
        
        """ Message logger """
        self.log = logging.getLogger(type(self).__name__)
        logging.basicConfig(
            format="%(levelname)s: %(name)s - %(message)s",
            level=logging.INFO,
        )
    
    #---------------------------------------------------------------------------
    def main(self):
        parser = argparse.ArgumentParser()
        parser.add_argument('input', type=str, help="Utilization report file")
        parser.add_argument('-o', dest='output', action='store', default="out.json", help='Output JSON file')
        self.options = parser.parse_args()
        
        with open(self.options.input, 'r') as f:
            
            # Collect all of the rpt's headings
            headings = []
            while(True):
                h = ReportHeading.get_next(f)
                if(h):
                    headings.append(h)
                else:
                    break
            
            # Seek to the "Utilization by Hierarchy" heading
            for heading in headings:
                if(heading.title == "1. Utilization by Hierarchy"):
                    f.seek(heading.pos)
                    break
            else:
                self.log.error("Not found")
                sys.exit(1)
            
            # Parse hierarchical utilization table
            util_table = Table.get_next(f, "/")
            table_headings = util_table.headings.copy()
            hier = Hierarchy.from_table(util_table)
            
            # Get list of value columns
            table_headings.remove("Instance")
            table_headings.remove("Module")
            
            # Write out to JSON
            json_dict = {
                "values":table_headings,
                "hierarchy":hier.to_dict()
            }
            with open(self.options.output, 'w') as json_file:
                json.dump(json_dict, json_file, indent=2)
        
    #-----------------------------------------------------------------------------
    def set_cmdline_args(self, parser):
        """
        Add ArgumentParser options
        extend or override this
        """
        parser.add_argument('-q', '--quiet', dest='quiet', action='store_true',default=False,
                            help="Suppress info messages")
        parser.add_argument('--verbose', dest='verbose', action='store_true',default=False,help='Enable debug messages')

#===============================================================================
if __name__ == '__main__':
    app = App()
    app.main()
    