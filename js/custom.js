var editText = function (editText){

editText.addEventListener('click',function (){
	
	var name = this.innerText;
	var activeOver = 0;
	this.innerHTML = '';
	//this.appendChild(this)
	
	editId = this.getAttribute('id');
	editClass = this.getAttribute('class');
	inputId = '#' + editClass +'_'+ editId;
	// Create an input type dynamicaly.
	
	var element = document.createElement('input');

	//Assign different attributes to the element.
	element.setAttribute( 'type', 'text');
	element.setAttribute( 'name', 'ext' + editId );
	element.setAttribute( 'id', inputId );
	element.setAttribute( 'size', 10);
	element.setAttribute( 'value', '');	

	//Append the element in page (in span).
	this.appendChild(element);
	document.getElementById(inputId).focus();
	

	if(activeOver == 0 ){
	var inputValue 
		this.onmouseleave=function(){

			// remove input and append text to span
			window.setTimeout(function() {
			this.innerHTML = inputId.value; 
				getInput = document.getElementById(inputId);		
				if ((typeof(getInput) !== 'undefined') && (getInput !== null)) {
					inputValue = getInput.value
					editText.removeChild(getInput)
				}
				if (inputValue != ''){
					editText.innerHTML += inputValue
				}else{
					editText.innerHTML += 'noName'
				}
				activeOver == 1; 
			}, 500);
		};
	};

})
};


// find all element with class edit & get their ID
spanElement = document.getElementsByClassName('edit');
var spanId =[ ];
for(var i=0; i<spanElement.length; i++ ){
	spanId[i] = spanElement[i].id
	editText(document.getElementById(spanId[i]))
}


function initAccordion(accordionElem){
  'use strict'
  //when panel is clicked, handlePanelClick is called.          

  function handlePanelClick(event){
    if(event.path[3].classList.contains('acc-active')){
      hidePanel(event.currentTarget);
    } else {
      showPanel(event.currentTarget);
    }
  }

//Hide currentPanel and show new panel.  
function showPanel(panel){
    //Hide current one. First time it will be null. 
     var expandedPanel = accordionElem.querySelector(".acc-active");
     if (expandedPanel){ 
         expandedPanel.classList.remove("acc-active");
         expandedPanel.nextElementSibling.style.display = "none";
     }
     
     //Show new one
     panel.classList.add("acc-active");
     panel.nextElementSibling.style.display = "block" ;
 }

function hidePanel(panel){
  let  x =panel.nextElementSibling
  x.style.display = x.style.display === "none" ? "block" : "none";
}
  var allPanelElems = accordionElem.querySelectorAll(".acc-panel");
  for (var i = 0, len = allPanelElems.length; i < len; i++){
       allPanelElems[i].addEventListener("click", handlePanelClick);
  }

  //By Default Show first panel
  //showPanel(allPanelElems[0])
}
//initAccordion(document.getElementById("accordion"));
