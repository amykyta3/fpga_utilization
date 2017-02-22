

var util_svg = d3.select("svg#util_treemap");
var util_svg_width = +util_svg.attr("width");
var util_svg_height = +util_svg.attr("height");
var fader = function(color) { return d3.interpolateRgb(color, "#fff")(0.2); };
var color = d3.scaleOrdinal(d3.schemeCategory20.map(fader));
var format = d3.format(",d");
var PREVIEW_DEPTH=1;
var TRANSITION_MS=500;

var root;
var current_top;
var treemap;
var current_dataset;

function sum_cell(d) {
    // Only sum cell if it is a leaf
    if(!d.hasOwnProperty('children')){
        return(d[current_dataset]);
    }
}
//==============================================================================
// Helper functions
//==============================================================================
function get_descendants(root, depth) {
    var c = [root];
    if((depth > 0) && (root.hasOwnProperty('children'))) {
        for(var i=0; i<root.children.length; i++){
            c = c.concat(get_descendants(root.children[i], depth-1));
        }
    }
    return(c);
}
//------------------------------------------------------------------------------
function noscale(n) {return n;}

function append_new_cells(cell_data, scale_x = noscale, scale_y = noscale) {
    var cells = util_svg.selectAll("g.cell")
        .data(cell_data, function(d){return(d.data.id);})
        .enter().append("g")
        //.enter().append(function(){return document.createElement("g");})
        .attr("class", "cell")
        .attr("transform", function(d) {
            return "translate(" + scale_x(d.x0) + "," + scale_y(d.y0) + ")";
        });
    
    // Draw rectangle for each cell
    cells.append("rect")
        .attr("id", function(d) { return d.data.id; })
        .attr("width", function(d) { return scale_x(d.x1) - scale_x(d.x0); })
        .attr("height", function(d) { return scale_y(d.y1) - scale_y(d.y0); })
        .attr("stroke", "black")
        .attr("fill", function(d) {
            return(color(d.data.id));
        })
        ;
    
    cells.append("text")
        .attr("x", function(d) {return (d.x1-d.x0)/2; })
        .attr("y", function(d) {return (d.y1-d.y0)/2; })
        .attr("text-anchor", "middle")
        .text(function(d) { return d.data.name; })
        .style("opacity", function(d) {
            // Only show for preview cells
            if(d.depth != PREVIEW_DEPTH) return(0);
            
            // Hide if too big for box
            var w = this.getComputedTextLength();
            if(((d.x1 - d.x0) > w) && ((d.y1 - d.y0) > 12)) return(1);
            return(0);
        });
    
    add_cell_events(cells);
    
    return(cells);
}
//------------------------------------------------------------------------------
function get_cells(cell_data) {
    var cells = util_svg.selectAll("g.cell")
        .data(cell_data, function(d){return(d.data.id);});
    return(cells);
}

//==============================================================================
// Events: Zoom in/out
//==============================================================================
function zoom_in(new_top) {
    var scale_x = d3.scaleLinear().range([0, util_svg_width]);
    var scale_y = d3.scaleLinear().range([0, util_svg_height]);
    scale_x.domain([new_top.x0, new_top.x1]);
    scale_y.domain([new_top.y0, new_top.y1]);
    
    var cell_data = get_descendants(new_top, PREVIEW_DEPTH);
    var newc = append_new_cells(cell_data);
    newc.style("opacity", 0);
    
    // recalculate node depths
    // otherwise, treemap() call gets confused
    new_top.eachBefore(function(node){
        if(node == new_top){
            node.depth = 0;
        }else{
            node.depth = node.parent.depth + 1;
        }
    });
    
    // Recalculate coordinates
    treemap(new_top);
    
    var inner_cells = get_cells(cell_data);
    var exiting_cells = inner_cells.exit();
    
    inner_cells.transition()
        .duration(TRANSITION_MS)
        .style("opacity", 1)
        .attr("transform", function(d) {
            return "translate(" + d.x0 + "," + d.y0 + ")";
        })
        .select("rect")
        .attr("width", function(d) {return (d.x1 - d.x0);})
        .attr("height", function(d) {return (d.y1 - d.y0);});
    
    inner_cells.select("text").transition()
        .duration(TRANSITION_MS)
        .attr("x", function(d) {return (d.x1-d.x0)/2; })
        .attr("y", function(d) {return (d.y1-d.y0)/2; })
        .style("opacity", function(d) {
            // Only show for preview cells
            if(d.depth != PREVIEW_DEPTH) return(0);
            
            // Hide if too big for box
            var w = this.getComputedTextLength();
            if(((d.x1 - d.x0) > w) && ((d.y1 - d.y0) > 12)) return(1);
            return(0);
        });
    
    exiting_cells.transition()
        .duration(TRANSITION_MS)
        .attr("transform", function(d) {
            return "translate(" + scale_x(d.x0) + "," + scale_y(d.y0) + ")";
        })
        .remove()
        .select("rect")
        .attr("width", function(d) {return (scale_x(d.x1) - scale_x(d.x0));})
        .attr("height", function(d) {return (scale_y(d.y1) - scale_y(d.y0));})
        ;
    
    
    current_top = new_top;
    update_crumbtrail();
}

//------------------------------------------------------------------------------
function zoom_out(new_top) {
    // recalculate node depths
    // otherwise, treemap() call gets confused
    new_top.eachBefore(function(node){
        if(node == new_top){
            node.depth = 0;
        }else{
            node.depth = node.parent.depth + 1;
        }
    });
    
    // Recalculate coordinates
    treemap(new_top);
    
    var scale_x = d3.scaleLinear().range([0, util_svg_width]);
    var scale_y = d3.scaleLinear().range([0, util_svg_height]);
    scale_x.domain([current_top.x0, current_top.x1]);
    scale_y.domain([current_top.y0, current_top.y1]);
    
    var cell_data = get_descendants(new_top, PREVIEW_DEPTH);
    
    var newc = append_new_cells(cell_data, scale_x, scale_y);
    var inner_cells = get_cells(cell_data);
    var exiting_cells = inner_cells.exit();
    
    newc.transition()
        .duration(TRANSITION_MS)
        .attr("transform", function(d) {
            return "translate(" + d.x0 + "," + d.y0 + ")";
        })
        .select("rect")
        .attr("width", function(d) {return (d.x1 - d.x0);})
        .attr("height", function(d) {return (d.y1 - d.y0);});
    
    newc.select("text").transition()
        .duration(TRANSITION_MS)
        .attr("x", function(d) {return (d.x1-d.x0)/2; })
        .attr("y", function(d) {return (d.y1-d.y0)/2; })
        .style("opacity", function(d) {
            // Only show for preview cells
            if(d.depth != PREVIEW_DEPTH) return(0);
            
            // Hide if too big for box
            var w = this.getComputedTextLength();
            if(((d.x1 - d.x0) > w) && ((d.y1 - d.y0) > 12)) return(1);
            return(0);
        });
    
    inner_cells.transition()
        .duration(TRANSITION_MS)
        .style("opacity", 1)
        .attr("transform", function(d) {
            return "translate(" + d.x0 + "," + d.y0 + ")";
        })
        .select("rect")
        .attr("width", function(d) {return (d.x1 - d.x0);})
        .attr("height", function(d) {return (d.y1 - d.y0);});
        
    inner_cells.select("text").transition()
        .duration(TRANSITION_MS)
        .attr("x", function(d) {return (d.x1-d.x0)/2; })
        .attr("y", function(d) {return (d.y1-d.y0)/2; })
        .style("opacity", function(d) {
            // Only show for preview cells
            if(d.depth != PREVIEW_DEPTH) return(0);
            
            // Hide if too big for box
            var w = this.getComputedTextLength();
            if(((d.x1 - d.x0) > w) && ((d.y1 - d.y0) > 12)) return(1);
            return(0);
        });
        
    exiting_cells.transition()
        .duration(TRANSITION_MS)
        .attr("transform", function(d) {
            return "translate(" + d.x0 + "," + d.y0 + ")";
        })
        .style("opacity", 0)
        .remove()
        .select("rect")
        .attr("width", function(d) {return (d.x1 - d.x0);})
        .attr("height", function(d) {return (d.y1 - d.y0);})
        ;
    
    current_top = new_top;
    update_crumbtrail();
}

//------------------------------------------------------------------------------
function add_cell_events(selection){
    selection.on("click", function(cell) {
        if(d3.event.shiftKey) {
            // Zoom out one step
            if(current_top.parent){
                zoom_out(current_top.parent);
            }
        } else {
            // Zoom in towards cell
            // Find child of current_top that is in the right direction
            if(cell == current_top) return;
            while(cell.parent != current_top){
                cell = cell.parent;
            }
            
            // Only worth zooming in if the cell has children
            if(cell.hasOwnProperty('children')){
                zoom_in(cell);
            }
        }
        
        //d3.event.preventDefault();
        d3.event.stopPropagation();
    });
}

//==============================================================================
// Event: Change plotted Value
//==============================================================================
function change_dataset(new_dataset){
    // Assign new sum function
    current_dataset = new_dataset;
    
    // Recalculate sum globally
    root.sum(sum_cell);
    treemap(current_top);
    
    var cells = get_cells(current_top.descendants());
    
    // Update Cells
    cells
        //.transition()
        //.duration(TRANSITION_MS)
        .attr("transform", function(d) {
            return "translate(" + d.x0 + "," + d.y0 + ")";
        })
        .select("rect")
        .attr("width", function(d) {return d.x1 - d.x0;})
        .attr("height", function(d) {return d.y1 - d.y0;});
}
    
//==============================================================================
// Main
//==============================================================================
function init_datasets(data){
    current_dataset = data.values[0];
    var table_rows = d3.select("form#datasets table#values").selectAll("tr.values")
        .data(data.values)
        .enter().append("tr")
        .attr("class", "values");
    table_rows.append("td")
        .append("input")
        .attr("type", "radio").attr("name", "mode")
        .attr("value", function(d) {return d})
        .property("checked", function(d) {
            return d == current_dataset})
        .on("change", change_dataset);
    table_rows.append("td")
        .text(function(d) {return d});
    table_rows.append("td")
        .attr("class", "value");
    table_rows.append("td")
        .attr("class", "pparent");
    table_rows.append("td")
        .attr("class", "ptotal");
}

//------------------------------------------------------------------------------
function init_treemap(data){
    
    // Skip upper hierarchies that are not interesting.
    // "zoom in" to the first node that has at least two children
    var hier_data = data.hierarchy;
    while(hier_data.children.length == 1){
        hier_data = hier_data.children[0];
    }
    
    // Convert data object into hierarchy structure
    root = d3.hierarchy(hier_data)
        // Generate an ID for each node (hierarchical name)
        .eachBefore(function(d) {
            d.data.id = (d.parent ? d.parent.data.id + "." : "") + d.data.name;
        })
        .sum(sum_cell)
        .sort(function(a, b) {
            return b.height - a.height || b.value - a.value;
        });
    current_top = root;
    
    // Generate the tree map
    // This basically populates the dataset with coordinates for each cell
    treemap = d3.treemap()
        .tile(d3.treemapResquarify)
        .size([util_svg_width, util_svg_height])
        .round(true)
        .paddingInner(3)
        .paddingOuter(3);
    treemap(current_top);
    
    append_new_cells(get_descendants(current_top, PREVIEW_DEPTH));
}

//------------------------------------------------------------------------------
function update_crumbtrail() {
    var data = current_top.ancestors();
    
    var crumb = d3.select("ul#crumbtrail").selectAll("li")
        .data(data.reverse(), function(d){return(d.data.id);});
    
    crumb.enter().append("li")
        .append("a")
        .attr("href", "javascript:void(0)")
        .on("click", zoom_out)
        .text(function(d) {return d.data.name});
    crumb.exit().remove();
    
    d3.select("form#datasets table#values").selectAll("td.value")
        .text(function(key) {
            return(current_top.data[key]);
        });
    
    d3.select("form#datasets table#values").selectAll("td.pparent")
        .text(function(key) {
            var pval;
            var val;
            var percent;
            val = current_top.data[key];
            if(current_top.parent){
                pval = current_top.parent.data[key];
            }else{
                pval = val;
            }
            
            if(pval == 0){
                percent = 0;
            }else{
                percent = 100*val/pval
            }
            return(percent.toFixed(2) + "%");
        });
    d3.select("form#datasets table#values").selectAll("td.ptotal")
        .text(function(key) {
            var pval;
            var val;
            var percent;
            val = current_top.data[key];
            pval = root.data[key];
            
            if(pval == 0){
                percent = 0;
            }else{
                percent = 100*val/pval
            }
            return(percent.toFixed(2) + "%");
        });
    
    d3.select("form#datasets table#info").selectAll("td#mod")
        .text(current_top.data.Module);
    d3.select("form#datasets table#info").selectAll("td#inst")
        .text(current_top.data.name);
}

//------------------------------------------------------------------------------
d3.json("out.json", function(error, data) {
    if (error) throw error;
    
    // Load available datasets
    init_datasets(data);
    
    init_treemap(data);
    
    update_crumbtrail();
});
