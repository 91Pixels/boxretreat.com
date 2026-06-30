/*!
 * Documenter 1.6
 * http://rxa.li/documenter
 *
 * Copyright 2011, Xaver Birsak
 * http://revaxarts.com
 *
 */
//if Cufon replace headings
if(typeof Cufon == 'function') Cufon.replace('h1, h2, h3, h4, h5, h6');
 
$(document).ready(function() {
	var timeout,
		sections = new Array(),
		sectionscount = 0,
		win = $(window),
		sidebar = $('#documenter_sidebar'),
		nav = $('#documenter_nav'),
		logo = $('#documenter_logo'),
		navanchors = nav.find('a'),
		timeoffset = 50,
		hash = location.hash || null;
		iDeviceNotOS4 = (navigator.userAgent.match(/iphone|ipod|ipad/i) && !navigator.userAgent.match(/OS 5/i)) || false,
		badIE = $('html').prop('class').match(/ie(6|7|8)/)|| false;
		
	//handle external links (new window)
	$('a[href^=http]').bind('click',function(){
		window.open($(this).attr('href'));
		return false;
	});
	
 
	
	
	//We need the position of each section until the full page with all images is loaded
	win.bind('load',function(){
		
		var sectionselector = 'section';
		
		//Documentation has subcategories		
		if(nav.find('ol').length){
			sectionselector = 'section, h4';
		}
		//saving some information
		$(sectionselector).each(function(i,e){
			var _this = $(this);
			var p = {
				id: this.id,
				pos: _this.offset().top
			};
			sections.push(p);
		});
		
		
 

	});
	
	//the function is called when the hash changes
 
 
	
 
	
	
});